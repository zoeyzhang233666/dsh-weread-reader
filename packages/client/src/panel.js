import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createApi } from './api.js'
import { buildChapterMarkdown, copyText, sanitizeFilename, saveMarkdownFile } from './copy.js'
import { paginateParagraphs } from './paginate.js'
import { parseChapterRange } from './range.js'
import { qrDataUrlFromText } from './qr.js'
import { CSS, CSS_VERSION } from './styles.js'

const api = createApi()

function useStyles() {
  useEffect(() => {
    const id = 'wrr-styles'
    let style = document.getElementById(id)
    if (!style) {
      style = document.createElement('style')
      style.id = id
      document.head.appendChild(style)
    }
    if (style.dataset.wrrVersion !== CSS_VERSION) {
      style.dataset.wrrVersion = CSS_VERSION
      style.textContent = CSS
    }
  }, [])
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function clampFontScale(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(1.6, Math.max(0.85, Math.round(n * 100) / 100))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function ReaderPanel() {
  useStyles()
  const [tab, setTab] = useState('shelf')
  const [status, setStatus] = useState(null)
  const [qr, setQr] = useState(null)
  const [qrPhase, setQrPhase] = useState('idle')
  const [otpDraft, setOtpDraft] = useState('')
  const [books, setBooks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [paragraphs, setParagraphs] = useState([])
  const [chapterText, setChapterText] = useState('')
  const [showToc, setShowToc] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [rangeDraft, setRangeDraft] = useState('1-10')
  const [selected, setSelected] = useState(() => new Set())
  const [fontScale, setFontScale] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [pages, setPages] = useState([])
  const [pageWidth, setPageWidth] = useState(0)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)
  const qrAbortRef = useRef(0)
  const heartbeatRef = useRef(null)
  const pageClipRef = useRef(null)
  const pageStripRef = useRef(null)
  const bookRef = useRef(null)
  const chapterRef = useRef(null)
  const chapterIdxRef = useRef(0)
  const chaptersRef = useRef([])
  const loadingRef = useRef(false)
  const tabRef = useRef(tab)
  const pageIndexRef = useRef(0)
  const pageCountRef = useRef(1)
  const pageWidthRef = useRef(0)
  const preferEndPageRef = useRef(false)
  const goPrevRef = useRef(() => {})
  const goNextRef = useRef(() => {})
  const pointerRef = useRef({ x: 0, y: 0, selecting: false })

  bookRef.current = book
  chapterRef.current = chapters[chapterIdx] || null
  chapterIdxRef.current = chapterIdx
  chaptersRef.current = chapters
  loadingRef.current = loading
  tabRef.current = tab
  pageIndexRef.current = pageIndex
  pageCountRef.current = Math.max(1, pages.length)
  pageWidthRef.current = pageWidth

  const chapter = chapters[chapterIdx] || null
  const pageCount = Math.max(1, pages.length)
  const canPrevChapter = Boolean(book && chapterIdx > 0 && !loading)
  const canNextChapter = Boolean(book && chapterIdx < chapters.length - 1 && !loading)
  const canPrevPage = pageIndex > 0 || canPrevChapter
  const canNextPage = pageIndex < pageCount - 1 || canNextChapter
  const selectedCount = selected.size

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2_800)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback((currentBook, currentChapter) => {
    stopHeartbeat()
    if (!currentBook || !currentChapter) return
    const payload = {
      bookId: currentBook.bookId,
      chapterUid: currentChapter.chapterUid,
      chapterIdx: currentChapter.chapterIdx ?? 0,
      focused: true,
    }
    void api.focus(payload).catch(() => {})
    heartbeatRef.current = setInterval(() => {
      void api.heartbeat(payload).catch(() => {})
    }, 30_000)
  }, [stopHeartbeat])

  useEffect(() => () => {
    stopHeartbeat()
    const currentBook = bookRef.current
    const currentChapter = chapterRef.current
    if (currentBook && currentChapter) {
      void api.blur({
        bookId: currentBook.bookId,
        chapterUid: currentChapter.chapterUid,
      }).catch(() => {})
    }
  }, [stopHeartbeat])

  const refreshStatus = useCallback(async () => {
    const next = await api.status()
    setStatus(next)
    if (next.fontScale != null) setFontScale(clampFontScale(next.fontScale))
    return next
  }, [])

  const loadShelf = useCallback(async ({ retries = 0, delayMs = 500, patient = false } = {}) => {
    setLoading(true)
    setError('')
    let lastError = null
    try {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          if (attempt > 0) await sleep(delayMs * attempt)
          const shelf = await api.shelf({ patient: patient || attempt > 0 })
          const nextBooks = shelf.books || []
          setBooks(nextBooks)
          if (nextBooks.length > 0 || attempt === retries) return nextBooks
        } catch (err) {
          lastError = err
          if (attempt === retries) throw err
        }
      }
      return []
    } catch (err) {
      const message = err?.message || lastError?.message || String(err)
      setError(message)
      if (/扫码|Login|expired|过期/i.test(message)) {
        setStatus(prev => (prev ? { ...prev, loggedIn: false } : { loggedIn: false }))
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
      .then((next) => {
        if (next?.loggedIn) return loadShelf({ retries: 2 })
        return undefined
      })
      .catch((err) => setError(err.message || String(err)))
  }, [loadShelf, refreshStatus])

  const openChapter = useCallback(async (currentBook, currentChapter, index = chapterIdx, { startAtEnd = false } = {}) => {
    if (!currentBook || !currentChapter) return
    setLoading(true)
    setError('')
    try {
      const body = await api.chapter(currentBook.bookId, currentChapter.chapterUid)
      setChapterIdx(index)
      setParagraphs(body.paragraphs || [])
      setChapterText(body.text || '')
      setPages([])
      preferEndPageRef.current = Boolean(startAtEnd)
      setPageIndex(0)
      setTab('reading')
      startHeartbeat(currentBook, {
        ...currentChapter,
        chapterIdx: currentChapter.chapterIdx ?? index,
      })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [chapterIdx, startHeartbeat])

  const openBook = useCallback(async (item) => {
    setLoading(true)
    setError('')
    try {
      const list = await api.chapters(item.bookId)
      const chaptersNext = list.chapters || []
      setBook(item)
      setChapters(chaptersNext)
      setSelected(new Set())
      setShowToc(false)
      setShowBatch(false)
      setRangeDraft(chaptersNext.length ? `1-${Math.min(10, chaptersNext.length)}` : '1-10')
      setChapterIdx(0)
      setParagraphs([])
      setChapterText('')
      setTab('reading')
      if (chaptersNext[0]) await openChapter(item, chaptersNext[0], 0)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [openChapter])

  const goPrevChapter = useCallback(() => {
    const idx = chapterIdxRef.current
    const list = chaptersRef.current
    if (!bookRef.current || idx <= 0 || loadingRef.current) return
    void openChapter(bookRef.current, list[idx - 1], idx - 1, { startAtEnd: true })
  }, [openChapter])

  const goNextChapter = useCallback(() => {
    const idx = chapterIdxRef.current
    const list = chaptersRef.current
    if (!bookRef.current || idx >= list.length - 1 || loadingRef.current) return
    void openChapter(bookRef.current, list[idx + 1], idx + 1)
  }, [openChapter])

  goPrevRef.current = goPrevChapter
  goNextRef.current = goNextChapter

  const applyPageTransform = useCallback((index, width) => {
    const strip = pageStripRef.current
    if (!strip) return
    const w = width || pageWidthRef.current || 0
    if (!w) return
    strip.style.transition = 'none'
    strip.style.transform = `translate3d(${-index * w}px, 0, 0)`
  }, [])

  const rebuildPages = useCallback(() => {
    const clip = pageClipRef.current
    if (!clip || tabRef.current !== 'reading') return
    const width = Math.max(1, Math.floor(clip.clientWidth))
    const height = Math.max(1, Math.floor(clip.clientHeight))
    if (width < 40 || height < 40) return

    const nextPages = paginateParagraphs({
      paragraphs,
      title: chapterRef.current?.title || '',
      width,
      height,
      fontScale,
    })
    const count = Math.max(1, nextPages.length)
    pageWidthRef.current = width
    pageCountRef.current = count
    setPageWidth(width)
    setPages(nextPages)

    const preferEnd = preferEndPageRef.current
    preferEndPageRef.current = false
    setPageIndex((current) => {
      const next = preferEnd
        ? count - 1
        : Math.max(0, Math.min(current, count - 1))
      pageIndexRef.current = next
      requestAnimationFrame(() => applyPageTransform(next, width))
      return next
    })
  }, [applyPageTransform, fontScale, paragraphs])

  useEffect(() => {
    if (tab !== 'reading' || !book) return undefined
    let frames = 0
    let raf = 0
    const run = () => {
      rebuildPages()
      frames += 1
      if (frames < 2) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)

    const clip = pageClipRef.current
    const observer = typeof ResizeObserver === 'function' && clip
      ? new ResizeObserver(() => rebuildPages())
      : null
    if (observer && clip) observer.observe(clip)
    window.addEventListener('resize', rebuildPages)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', rebuildPages)
    }
  }, [tab, book, chapterIdx, paragraphs, fontScale, showToc, showBatch, rebuildPages])

  useEffect(() => {
    applyPageTransform(pageIndex, pageWidth)
  }, [applyPageTransform, pageIndex, pageWidth, pages])

  const pageBy = useCallback((direction) => {
    if (tabRef.current !== 'reading' || !bookRef.current || loadingRef.current) return
    const current = pageIndexRef.current
    const total = pageCountRef.current
    if (direction > 0) {
      if (current < total - 1) {
        const next = current + 1
        pageIndexRef.current = next
        setPageIndex(next)
        applyPageTransform(next)
        return
      }
      goNextRef.current()
      return
    }
    if (current > 0) {
      const next = current - 1
      pageIndexRef.current = next
      setPageIndex(next)
      applyPageTransform(next)
      return
    }
    goPrevRef.current()
  }, [applyPageTransform])

  const onReaderPointerDown = useCallback((event) => {
    if (event.button !== 0) return
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      selecting: false,
    }
  }, [])

  const onReaderPointerMove = useCallback((event) => {
    const start = pointerRef.current
    if (!start) return
    if (Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4) {
      pointerRef.current = { ...start, selecting: true }
    }
  }, [])

  const onReaderClick = useCallback((event) => {
    if (tabRef.current !== 'reading' || !bookRef.current) return
    if (event.button !== 0) return
    if (event.target?.closest?.('button, a, input, textarea, select, label, .wrr-toc, .wrr-batch, .wrr-reader-chrome')) return
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
    if (selection && String(selection).trim()) return
    if (pointerRef.current?.selecting) return

    const el = pageClipRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (x < rect.width * 0.32) pageBy(-1)
    else pageBy(1)
  }, [pageBy])

  useEffect(() => {
    const onKey = (event) => {
      if (tabRef.current !== 'reading' || !bookRef.current) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNextChapter()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevChapter()
      } else if (
        event.key === 'ArrowDown'
        || event.key === 'PageDown'
        || event.key === ' '
        || event.code === 'Space'
      ) {
        event.preventDefault()
        pageBy(event.shiftKey ? -1 : 1)
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        pageBy(-1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        pageIndexRef.current = 0
        setPageIndex(0)
        applyPageTransform(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        const last = Math.max(0, pageCountRef.current - 1)
        pageIndexRef.current = last
        setPageIndex(last)
        applyPageTransform(last)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyPageTransform, goNextChapter, goPrevChapter, pageBy])

  const stopQr = useCallback(() => {
    qrAbortRef.current += 1
    setQr(null)
    setQrPhase('idle')
    setOtpDraft('')
  }, [])

  const pollQr = useCallback(async (uid, generation, otp = '') => {
    setQrPhase(otp ? 'need_otp' : 'waiting')
    while (qrAbortRef.current === generation) {
      let result
      try {
        result = await api.waitQr({ uid, otp })
      } catch (err) {
        if (qrAbortRef.current !== generation) return
        setQrPhase('error')
        setError(err.message || String(err))
        return
      }
      if (qrAbortRef.current !== generation) return
      if (result.status === 'ok') {
        stopQr()
        setTab('shelf')
        await refreshStatus()
        // Weread shelf sync is often empty for a beat right after QR login.
        const nextBooks = await loadShelf({ retries: 4, delayMs: 800, patient: true })
        if (!nextBooks.length) {
          showToast('已登录，书架同步中…可点刷新')
        } else {
          showToast('登录成功')
        }
        return
      }
      if (result.status === 'need_otp') {
        setQrPhase('need_otp')
        if (result.error) setError(result.error)
        return
      }
      if (result.status === 'expired') {
        setQrPhase('expired')
        setError(result.error || '二维码已过期')
        return
      }
      if (result.status === 'error') {
        setQrPhase('error')
        setError(result.error || '登录失败')
        return
      }
    }
  }, [loadShelf, refreshStatus, showToast, stopQr])

  const startQr = useCallback(async () => {
    const generation = ++qrAbortRef.current
    setError('')
    setOtpDraft('')
    setQrPhase('starting')
    setLoading(true)
    try {
      const session = await api.startQr()
      if (qrAbortRef.current !== generation) return
      const qrDataUrl = await qrDataUrlFromText(session.qrUrl)
      if (qrAbortRef.current !== generation) return
      setQr({ ...session, qrDataUrl })
      setLoading(false)
      await pollQr(session.uid, generation)
    } catch (err) {
      if (qrAbortRef.current !== generation) return
      setQrPhase('error')
      setError(err.message || String(err))
      setLoading(false)
    }
  }, [pollQr])

  const submitOtp = useCallback(async () => {
    if (!qr?.uid || !otpDraft.trim()) return
    setError('')
    const generation = qrAbortRef.current
    await pollQr(qr.uid, generation, otpDraft.trim())
  }, [otpDraft, pollQr, qr])

  const applyRange = () => {
    const indexes = parseChapterRange(rangeDraft, chapters.length)
    if (!indexes.length) {
      showToast('区间无效，例如 1-10 或 1,3,5-8')
      return
    }
    setSelected(new Set(indexes.map(index => String(chapters[index].chapterUid))))
    showToast(`已选 ${indexes.length} 章`)
  }

  const selectAllVisible = () => {
    setSelected(new Set(chapters.map(item => String(item.chapterUid))))
  }

  const clearSelected = () => setSelected(new Set())

  const copyCurrentChapter = async () => {
    if (!book || !chapterText.trim()) {
      showToast('当前章节没有可复制的内容')
      return
    }
    const markdown = buildChapterMarkdown({
      bookTitle: book.title,
      author: book.author,
      chapterTitle: chapter?.title,
      text: chapterText,
    })
    try {
      await copyText(markdown)
      showToast('已复制本章')
    } catch (err) {
      setError(err.message || String(err))
    }
  }

  const saveCurrentChapter = async () => {
    if (!book || !chapterText.trim()) {
      showToast('当前章节没有可保存的内容')
      return
    }
    const stem = sanitizeFilename(`${book.title}-${chapter?.title || '本章'}`)
    const markdown = buildChapterMarkdown({
      bookTitle: book.title,
      author: book.author,
      chapterTitle: chapter?.title,
      text: chapterText,
    })
    try {
      const saved = await saveMarkdownFile(`${stem}.md`, markdown)
      showToast(`已保存 ${saved.name}`)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err.message || String(err))
    }
  }

  const exportSelected = async ({ copy = true, save = false } = {}) => {
    if (!book || !selectedCount) {
      showToast('请先用区间选章，例如 1-10')
      return
    }
    setLoading(true)
    setError('')
    try {
      const ordered = chapters
        .filter(item => selected.has(String(item.chapterUid)))
        .map(item => String(item.chapterUid))
      const result = await api.exportChapters({
        bookId: book.bookId,
        bookTitle: book.title,
        author: book.author,
        chapterUids: ordered,
      })
      if (copy) {
        await copyText(result.markdown)
        showToast(`已复制 ${ordered.length} 章`)
      }
      if (save) {
        const stem = sanitizeFilename(`${book.title}-选中${ordered.length}章`)
        const saved = await saveMarkdownFile(`${stem}.md`, result.markdown)
        showToast(`已保存 ${saved.name}`)
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const adjustFont = async (delta) => {
    const next = clampFontScale(fontScale + delta)
    setFontScale(next)
    try {
      await api.prefs({ fontScale: next })
    } catch {
      // local scale still applies
    }
  }

  const selectedLabel = useMemo(() => (
    selectedCount ? `已选 ${selectedCount} 章` : '未选章节'
  ), [selectedCount])

  return (
    <div className="wrr-root" style={{ '--wrr-font-scale': String(fontScale) }}>
      <div className="wrr-top">
        <button type="button" className="wrr-tab" data-active={tab === 'shelf' ? '1' : '0'} onClick={() => setTab('shelf')}>书架</button>
        <button type="button" className="wrr-tab" data-active={tab === 'reading' ? '1' : '0'} onClick={() => setTab('reading')} disabled={!book}>阅读</button>
        <div className="wrr-spacer" />
        <span className="wrr-meta">{status?.loggedIn ? '已登录' : '未登录'}</span>
      </div>
      <div
        className="wrr-body"
        data-mode={tab === 'reading' && book ? 'reading' : 'shelf'}
      >
        {error ? <div className="wrr-error">{error}</div> : null}

        {tab === 'shelf' ? (
          !status?.loggedIn ? (
            <div className="wrr-login">
              <h3>微信扫码登录</h3>
              <p>用微信扫描二维码，在手机上确认后即可进入书架。登录态只保存在当前 DSH profile。</p>
              {qr?.qrDataUrl ? (
                <div className="wrr-qr">
                  <img src={qr.qrDataUrl} alt="微信读书登录二维码" width={240} height={240} />
                  <div className="wrr-qr-status">
                    {qrPhase === 'waiting' ? '等待扫码确认…' : null}
                    {qrPhase === 'starting' ? '正在生成二维码…' : null}
                    {qrPhase === 'need_otp' ? '请输入手机上显示的验证码' : null}
                    {qrPhase === 'expired' ? '二维码已过期' : null}
                    {qrPhase === 'error' ? '登录失败，请重试' : null}
                  </div>
                </div>
              ) : (
                <div className="wrr-qr-placeholder">点击下方按钮生成二维码</div>
              )}
              {qrPhase === 'need_otp' ? (
                <div className="wrr-otp">
                  <input
                    value={otpDraft}
                    onChange={event => setOtpDraft(event.target.value)}
                    placeholder="验证码"
                    maxLength={8}
                    inputMode="numeric"
                  />
                  <button type="button" className="wrr-btn primary" onClick={submitOtp} disabled={loading || !otpDraft.trim()}>验证</button>
                </div>
              ) : null}
              <div className="wrr-login-actions">
                <button type="button" className="wrr-btn primary" onClick={startQr} disabled={loading || qrPhase === 'starting'}>
                  {qr ? '刷新二维码' : '生成二维码'}
                </button>
                {qr ? <button type="button" className="wrr-btn" onClick={stopQr}>取消</button> : null}
              </div>
            </div>
          ) : (
            <div className="wrr-shelf">
              <div className="wrr-reader-head">
                <button type="button" className="wrr-btn" onClick={() => loadShelf({ retries: 2 })} disabled={loading}>刷新</button>
                <button
                  type="button"
                  className="wrr-btn"
                  onClick={async () => {
                    stopQr()
                    stopHeartbeat()
                    await api.logout()
                    setStatus(prev => (prev ? { ...prev, loggedIn: false } : { loggedIn: false }))
                    setBooks([])
                    setBook(null)
                    setChapters([])
                    setParagraphs([])
                    setChapterText('')
                    setSelected(new Set())
                    setError('')
                  }}
                >
                  退出登录
                </button>
                <span className="wrr-meta">{loading && !books.length ? '同步中…' : `${books.length} 本`}</span>
              </div>
              {books.length === 0 && !loading ? <div className="wrr-empty">书架为空，可再点刷新</div> : null}
              {books.map(item => (
                <button key={item.bookId} type="button" className="wrr-book" onClick={() => openBook(item)}>
                  {item.cover ? <img src={item.cover} alt="" loading="lazy" decoding="async" /> : <div />}
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.author}</span>
                  </div>
                  <span>{typeof item.progress === 'number' ? `${item.progress}%` : ''}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {tab === 'reading' && book ? (
          <div className="wrr-reading">
            <div className="wrr-reader-chrome">
              <div className="wrr-reader-head">
                <h2>{book.title}</h2>
                <button type="button" className="wrr-btn compact" onClick={() => setShowToc(value => !value)}>
                  {showToc ? '收起目录' : '目录'}
                </button>
                <button
                  type="button"
                  className="wrr-btn compact"
                  data-active={showBatch ? '1' : '0'}
                  onClick={() => {
                    setShowBatch(value => !value)
                    if (!showBatch) setShowToc(true)
                  }}
                >
                  批量复制
                </button>
                <button type="button" className="wrr-btn compact" onClick={() => adjustFont(-0.08)} title="减小字号">A-</button>
                <button type="button" className="wrr-btn compact" onClick={() => adjustFont(0.08)} title="增大字号">A+</button>
              </div>

              {showBatch ? (
                <div className="wrr-batch">
                  <div className="wrr-batch-row">
                    <input
                      type="text"
                      value={rangeDraft}
                      onChange={event => setRangeDraft(event.target.value)}
                      placeholder="例如 1-10 或 1,3,5-8"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          applyRange()
                        }
                      }}
                    />
                    <button type="button" className="wrr-btn compact" onClick={applyRange}>按区间选</button>
                    <button type="button" className="wrr-btn compact" onClick={selectAllVisible}>全选</button>
                    <button type="button" className="wrr-btn compact" onClick={clearSelected}>清空</button>
                  </div>
                  <div className="wrr-batch-row">
                    <button
                      type="button"
                      className="wrr-btn primary compact"
                      onClick={() => exportSelected({ copy: true })}
                      disabled={!selectedCount || loading}
                    >
                      复制选中
                    </button>
                    <button
                      type="button"
                      className="wrr-btn compact"
                      onClick={() => exportSelected({ copy: false, save: true })}
                      disabled={!selectedCount || loading}
                    >
                      保存选中
                    </button>
                    <span className="wrr-meta">{selectedLabel} · 输入 1-10 即可</span>
                  </div>
                </div>
              ) : null}

              {showToc ? (
                <div className="wrr-toc">
                  {chapters.map((item, index) => (
                    <button
                      key={item.chapterUid}
                      type="button"
                      className="wrr-toc-item"
                      data-active={index === chapterIdx ? '1' : '0'}
                      data-picked={selected.has(String(item.chapterUid)) ? '1' : '0'}
                      onClick={() => openChapter(book, item, index)}
                    >
                      <span className="wrr-toc-index">{index + 1}</span>
                      <span className="wrr-toc-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="wrr-page-frame">
              <div
                className="wrr-page-clip"
                ref={pageClipRef}
                onPointerDown={onReaderPointerDown}
                onPointerMove={onReaderPointerMove}
                onClick={onReaderClick}
                title="左侧上一页，右侧下一页；划选文字可复制"
              >
                {!paragraphs.length && !loading ? (
                  <div className="wrr-empty">本章没有可读正文</div>
                ) : (
                  <div
                    className="wrr-page-strip"
                    ref={pageStripRef}
                    style={pageWidth ? {
                      width: `${Math.max(1, pages.length) * pageWidth}px`,
                      transform: `translate3d(${-pageIndex * pageWidth}px, 0, 0)`,
                    } : undefined}
                  >
                    {(pages.length ? pages : [paragraphs]).map((pageParagraphs, index) => (
                      <section
                        key={`page-${index}`}
                        className="wrr-page"
                        style={pageWidth ? { width: `${pageWidth}px` } : undefined}
                      >
                        {index === 0 && chapter?.title ? <h3>{chapter.title}</h3> : null}
                        {pageParagraphs.map(paragraph => (
                          <p key={paragraph.id}>{paragraph.text}</p>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {toast ? <div className="wrr-toast" role="status">{toast}</div> : null}

      {tab === 'reading' && book ? (
        <div className="wrr-bottom-nav" role="navigation" aria-label="阅读导航">
          <button type="button" className="wrr-page-btn" disabled={!canPrevChapter} onClick={goPrevChapter} title="上一章 (←)" aria-label="上一章">‹‹</button>
          <button type="button" className="wrr-page-btn" disabled={!canPrevPage} onClick={() => pageBy(-1)} title="上一页 (↑)" aria-label="上一页">‹</button>
          <div className="wrr-page-info">
            <strong>{chapter?.title || book.title}</strong>
            <span>
              {`页 ${pageIndex + 1}/${pageCount}`}
              {chapters.length ? ` · 章 ${chapterIdx + 1}/${chapters.length}` : ''}
              {' · ↑↓翻页 · ←→翻章'}
            </span>
          </div>
          <div className="wrr-bottom-actions">
            <button
              type="button"
              className="wrr-btn primary compact"
              onClick={copyCurrentChapter}
              disabled={!chapterText.trim() || loading}
              title="复制当前章节"
            >
              复制本章
            </button>
            <button
              type="button"
              className="wrr-btn compact"
              onClick={saveCurrentChapter}
              disabled={!chapterText.trim() || loading}
              title="保存当前章节 Markdown"
            >
              保存
            </button>
          </div>
          <button type="button" className="wrr-page-btn" disabled={!canNextPage} onClick={() => pageBy(1)} title="下一页 (↓ / 空格)" aria-label="下一页">›</button>
          <button type="button" className="wrr-page-btn" disabled={!canNextChapter} onClick={goNextChapter} title="下一章 (→)" aria-label="下一章">››</button>
        </div>
      ) : null}
    </div>
  )
}

export function ReaderTitle() {
  return '微信读书'
}
