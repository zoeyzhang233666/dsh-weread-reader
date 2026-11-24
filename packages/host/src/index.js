import z from '@deepseek-ai/schemastery'
import { pathname, readJson, sendJson } from './http.js'
import { createReadingClock } from './reading.js'
import * as weread from './weread/client.js'
import { createQrSession, finishLoginFromInfo, pollLoginInfo, refreshCookie } from './weread/login.js'
import { buildChaptersMarkdown, paragraphsFromText } from './exportText.js'

export const name = 'weread-reader'
export const inject = ['webServer', 'settings']

export const Config = z.object({
  cookie: z.string().default('').volatile(),
  cookieUpdatedAt: z.number().default(0).volatile(),
  fontScale: z.number().default(1).volatile(),
})

const API = '/weread-reader/api'
const COOKIE_REFRESH_MS = 45 * 60 * 1000
const MAX_BATCH = 40

function live(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get()
  }
  return value ?? fallback
}

function settingsOf(config) {
  const raw = config && typeof config === 'object' ? config : {}
  return {
    get cookie() { return String(live(raw.cookie, '') || '') },
    get cookieUpdatedAt() {
      const value = Number(live(raw.cookieUpdatedAt, 0) || 0)
      return Number.isFinite(value) ? value : 0
    },
    get fontScale() {
      const value = Number(live(raw.fontScale, 1) || 1)
      if (!Number.isFinite(value)) return 1
      return Math.min(1.6, Math.max(0.85, value))
    },
  }
}

function requireCookie(settings, res) {
  if (settings.cookie.trim()) return settings.cookie.trim()
  sendJson(res, 401, { error: '请先扫码登录微信读书。' })
  return null
}

export function apply(ctx, config) {
  const settings = settingsOf(config)
  const clocks = new Map()

  const persist = async (patch) => {
    const writer = ctx.get('settings')
    if (!writer?.mutate) throw new Error('Settings service unavailable.')
    const ops = Object.entries(patch).map(([path, value]) => ({ op: 'set', path: [path], value }))
    await writer.mutate(name, ops)
  }

  const saveCookie = async (cookie) => {
    await persist({ cookie, cookieUpdatedAt: Date.now() })
  }

  const maybeRefreshCookie = async ({ force = false } = {}) => {
    const cookie = settings.cookie.trim()
    if (!cookie) return null
    const age = Date.now() - settings.cookieUpdatedAt
    if (!force && settings.cookieUpdatedAt > 0 && age < COOKIE_REFRESH_MS) return cookie
    try {
      const refreshed = await refreshCookie(cookie)
      if (refreshed.changed) {
        const verified = await weread.getUser(refreshed.cookie)
        const next = verified.cookie || refreshed.cookie
        await saveCookie(next)
        return next
      }
      if (settings.cookieUpdatedAt <= 0) await persist({ cookieUpdatedAt: Date.now() })
      return cookie
    } catch {
      return cookie
    }
  }

  const pathIs = (path, suffix) => path === `${API}${suffix}` || path === suffix

  async function handle(req, res) {
    const path = pathname(req)
    try {
      if (pathIs(path, '/status') && req.method === 'GET') {
        if (settings.cookie.trim()) await maybeRefreshCookie()
        sendJson(res, 200, {
          loggedIn: Boolean(settings.cookie.trim()),
          fontScale: settings.fontScale,
        })
        return
      }

      if (pathIs(path, '/auth/qr/start') && req.method === 'POST') {
        const session = await createQrSession()
        sendJson(res, 200, session)
        return
      }

      if (pathIs(path, '/auth/qr/wait') && req.method === 'POST') {
        const body = await readJson(req)
        const uid = String(body.uid || '').trim()
        if (!uid) {
          sendJson(res, 400, { error: 'uid required' })
          return
        }
        const poll = await pollLoginInfo(uid, { otp: String(body.otp || '') })
        if (poll.status !== 'ok') {
          sendJson(res, 200, {
            status: poll.status,
            error: poll.error || undefined,
          })
          return
        }
        const cookie = await finishLoginFromInfo(poll.info, {
          getUser: weread.getUser,
          refreshCookie,
        })
        await saveCookie(cookie)
        try { await weread.getShelf(cookie, { retries: 5, patientEmpty: true }) } catch { /* warm shelf */ }
        sendJson(res, 200, { status: 'ok', loggedIn: true })
        return
      }

      if (pathIs(path, '/auth/refresh') && req.method === 'POST') {
        const cookie = await maybeRefreshCookie({ force: true })
        if (!cookie) {
          sendJson(res, 401, { error: 'Not logged in.' })
          return
        }
        sendJson(res, 200, { ok: true, loggedIn: true })
        return
      }

      if (pathIs(path, '/auth/logout') && req.method === 'POST') {
        await persist({ cookie: '', cookieUpdatedAt: 0 })
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/prefs` && req.method === 'POST') {
        const body = await readJson(req)
        const patch = {}
        if (body.fontScale != null) {
          const scale = Number(body.fontScale)
          if (Number.isFinite(scale)) {
            patch.fontScale = Math.min(1.6, Math.max(0.85, scale))
          }
        }
        if (Object.keys(patch).length) await persist(patch)
        sendJson(res, 200, { fontScale: settings.fontScale })
        return
      }

      if (path === `${API}/shelf` && req.method === 'GET') {
        let cookie = requireCookie(settings, res)
        if (!cookie) return
        cookie = (await maybeRefreshCookie()) || cookie
        const url = new URL(req.url || '/', 'http://localhost')
        const patientEmpty = url.searchParams.get('patient') === '1'
        try {
          const shelf = await weread.getShelf(cookie, {
            retries: patientEmpty ? 5 : 3,
            patientEmpty,
          })
          sendJson(res, 200, shelf)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (/expired|Login|过期|扫码/i.test(message)) {
            const retryCookie = await maybeRefreshCookie({ force: true })
            if (retryCookie && retryCookie !== cookie) {
              const shelf = await weread.getShelf(retryCookie, {
                retries: patientEmpty ? 5 : 3,
                patientEmpty,
              })
              sendJson(res, 200, shelf)
              return
            }
          }
          throw error
        }
        return
      }

      if (path === `${API}/chapters` && req.method === 'GET') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const url = new URL(req.url || '/', 'http://localhost')
        const bookId = url.searchParams.get('bookId')
        if (!bookId) {
          sendJson(res, 400, { error: 'bookId required' })
          return
        }
        const chapters = await weread.getChapters(cookie, bookId)
        sendJson(res, 200, { chapters })
        return
      }

      if (path === `${API}/chapter` && req.method === 'GET') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const url = new URL(req.url || '/', 'http://localhost')
        const bookId = url.searchParams.get('bookId')
        const chapterUid = url.searchParams.get('chapterUid')
        if (!bookId || !chapterUid) {
          sendJson(res, 400, { error: 'bookId and chapterUid required' })
          return
        }
        const content = await weread.getChapterContent(cookie, bookId, chapterUid)
        const paragraphs = paragraphsFromText(content.text)
        sendJson(res, 200, {
          format: content.format,
          text: content.text,
          paragraphs,
        })
        return
      }

      if (path === `${API}/chapters/export` && req.method === 'POST') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const body = await readJson(req)
        const bookId = String(body.bookId || '').trim()
        const bookTitle = String(body.bookTitle || '').trim()
        const author = String(body.author || '').trim()
        const uids = Array.isArray(body.chapterUids)
          ? body.chapterUids.map(uid => String(uid || '').trim()).filter(Boolean)
          : []
        if (!bookId || !uids.length) {
          sendJson(res, 400, { error: 'bookId and chapterUids required' })
          return
        }
        if (uids.length > MAX_BATCH) {
          sendJson(res, 400, { error: `一次最多导出 ${MAX_BATCH} 章` })
          return
        }
        const catalog = await weread.getChapters(cookie, bookId)
        const byUid = new Map(catalog.map(item => [String(item.chapterUid), item]))
        const chapters = []
        for (const chapterUid of uids) {
          const meta = byUid.get(String(chapterUid))
          const content = await weread.getChapterContent(cookie, bookId, chapterUid)
          chapters.push({
            chapterUid,
            title: meta?.title || `章节 ${chapterUid}`,
            chapterIdx: meta?.chapterIdx,
            text: content.text,
            paragraphs: paragraphsFromText(content.text),
          })
        }
        const markdown = buildChaptersMarkdown({
          bookTitle: bookTitle || bookId,
          author,
          chapters,
        })
        sendJson(res, 200, { chapters, markdown })
        return
      }

      if (path === `${API}/reading/focus` && req.method === 'POST') {
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        const clock = clocks.get(key) ?? createReadingClock()
        clocks.set(key, clock)
        clock.focus()
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/reading/blur` && req.method === 'POST') {
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        clocks.get(key)?.blur()
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/reading/heartbeat` && req.method === 'POST') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        const clock = clocks.get(key) ?? createReadingClock()
        clocks.set(key, clock)
        if (body.focused !== false) clock.focus()
        else clock.blur()
        const rt = clock.takeSeconds()
        if (rt <= 0) {
          sendJson(res, 200, { ok: true, rt: 0, reported: false })
          return
        }
        const reported = await weread.reportRead(cookie, {
          bookId: body.bookId,
          chapterUid: body.chapterUid,
          chapterIdx: body.chapterIdx ?? 0,
          rt,
          pr: body.pr ?? 0,
        })
        sendJson(res, 200, { ok: true, rt, reported })
        return
      }

      sendJson(res, 404, { error: 'not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 502, { error: message })
    }
  }

  ctx.effect(() => {
    console.log('[weread-reader] host loaded')
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: API,
      handler: (req, res) => {
        handle(req, res).catch(error => {
          if (!res.headersSent) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        })
      },
    })
    return () => {
      dispose()
      console.log('[weread-reader] host unloaded')
    }
  })
}
