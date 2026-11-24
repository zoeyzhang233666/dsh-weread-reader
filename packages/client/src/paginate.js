/**
 * Pack paragraphs into discrete pages that fit a fixed width/height box.
 * Uses an off-screen probe with the same typography as the reader.
 */
export function paginateParagraphs({
  paragraphs = [],
  title = '',
  width,
  height,
  fontScale = 1,
} = {}) {
  const w = Math.max(1, Math.floor(Number(width) || 0))
  const h = Math.max(1, Math.floor(Number(height) || 0))
  const list = Array.isArray(paragraphs) ? paragraphs : []
  if (!w || !h) {
    return list.length ? [list] : [[]]
  }
  if (!list.length) return [[]]

  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${w}px`,
    `height:${h}px`,
    'overflow:hidden',
    'visibility:hidden',
    'pointer-events:none',
    'box-sizing:border-box',
    'margin:0',
    'padding:0',
    `font-size:${16 * fontScale}px`,
    'line-height:1.85',
    'letter-spacing:0.01em',
    'font-family:"Microsoft YaHei","微软雅黑","PingFang SC","Noto Sans SC",sans-serif',
    'white-space:normal',
  ].join(';')

  const titleEl = document.createElement('h3')
  titleEl.style.cssText = 'margin:0 0 14px;padding:0;font-size:1.05em;font-weight:600;line-height:1.4;'
  titleEl.textContent = title || ''

  document.body.appendChild(probe)

  const fits = (nodes) => {
    probe.replaceChildren(...nodes)
    return probe.scrollHeight <= h + 0.5
  }

  const makeParagraphNode = (text) => {
    const p = document.createElement('p')
    p.style.cssText = 'margin:0 0 1em;padding:0;white-space:pre-wrap;word-break:break-word;'
    p.textContent = text
    return p
  }

  const pages = []
  let current = []
  let isFirstPage = true

  const nodesFor = (items, withTitle) => {
    const nodes = []
    if (withTitle && title) nodes.push(titleEl.cloneNode(true))
    for (const item of items) nodes.push(makeParagraphNode(item.text))
    return nodes
  }

  for (const item of list) {
    const next = [...current, item]
    if (fits(nodesFor(next, isFirstPage))) {
      current = next
      continue
    }
    if (current.length) {
      pages.push(current)
      isFirstPage = false
      current = []
    }
    // Single oversized paragraph: still place alone so we never stall.
    current = [item]
    if (!fits(nodesFor(current, isFirstPage)) && pages.length === 0) {
      // Keep it anyway; page will clip as last resort.
    }
  }

  if (current.length) pages.push(current)
  probe.remove()
  return pages.length ? pages : [[]]
}
