export function sanitizeFilename(name) {
  const cleaned = String(name ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return cleaned || 'weread'
}

export function buildChapterMarkdown({ bookTitle, author = '', chapterTitle, text }) {
  const lines = [
    `# ${bookTitle || 'Untitled'}`,
    '',
    `- 章节：${chapterTitle || ''}`,
  ]
  if (author) lines.push(`- 作者：${author}`)
  lines.push(`- 导出时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('')
  lines.push(String(text || '').trim() || '_（本章无正文）_')
  lines.push('')
  return lines.join('\n')
}

export async function copyText(text) {
  const value = String(text || '')
  if (!value) throw new Error('没有可复制的内容')
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return { method: 'clipboard' }
  }
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('复制失败')
  return { method: 'execCommand' }
}

async function writeWithSavePicker(filename, markdown) {
  const handle = await window.showSaveFilePicker({
    suggestedName: filename.endsWith('.md') ? filename : `${filename}.md`,
    types: [{
      description: 'Markdown',
      accept: { 'text/markdown': ['.md'], 'text/plain': ['.md', '.txt'] },
    }],
  })
  const writable = await handle.createWritable()
  await writable.write(markdown)
  await writable.close()
  return { method: 'picker', name: handle.name || filename }
}

function downloadBlob(filename, markdown) {
  const stem = filename.endsWith('.md') ? filename : `${filename}.md`
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = stem
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
  return { method: 'download', name: stem }
}

export async function saveMarkdownFile(filename, markdown) {
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      return await writeWithSavePicker(filename, markdown)
    } catch (error) {
      if (error?.name === 'AbortError') throw error
    }
  }
  return downloadBlob(filename, markdown)
}
