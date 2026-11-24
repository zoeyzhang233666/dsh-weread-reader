import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildChaptersMarkdown, paragraphsFromText, sanitizeFilename } from '../packages/host/src/exportText.js'

describe('paragraphsFromText', () => {
  it('splits on blank lines', () => {
    const paragraphs = paragraphsFromText('第一段\n\n第二段\n\n第三段')
    assert.equal(paragraphs.length, 3)
    assert.equal(paragraphs[1].text, '第二段')
  })

  it('falls back to single newlines', () => {
    const paragraphs = paragraphsFromText('一行\n二行')
    assert.equal(paragraphs.length, 2)
  })
})

describe('buildChaptersMarkdown', () => {
  it('includes chapter titles and bodies', () => {
    const md = buildChaptersMarkdown({
      bookTitle: '测试书',
      author: '作者',
      chapters: [
        { title: '第一章', text: '你好' },
        { title: '第二章', text: '世界' },
      ],
    })
    assert.match(md, /# 测试书/)
    assert.match(md, /## 第一章/)
    assert.match(md, /你好/)
    assert.match(md, /## 第二章/)
  })
})

describe('sanitizeFilename', () => {
  it('strips illegal characters', () => {
    assert.equal(sanitizeFilename('a/b:c*'), 'a b c')
  })
})
