import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { paginateParagraphs } from '../packages/client/src/paginate.js'

describe('paginateParagraphs', () => {
  it('returns empty page for no paragraphs', () => {
    assert.deepEqual(paginateParagraphs({ paragraphs: [], width: 300, height: 400 }), [[]])
  })

  it('keeps a single short paragraph on one page', () => {
    // jsdom-less environments still have a minimal document in DSH node tests?
    // Skip DOM packing when document is unavailable.
    if (typeof document === 'undefined') return
    const pages = paginateParagraphs({
      paragraphs: [{ id: 'p1', text: '你好' }],
      title: '第一章',
      width: 320,
      height: 480,
      fontScale: 1,
    })
    assert.equal(pages.length, 1)
    assert.equal(pages[0][0].text, '你好')
  })
})
