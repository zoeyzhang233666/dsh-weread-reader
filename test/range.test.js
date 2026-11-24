import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseChapterRange } from '../packages/client/src/range.js'

describe('parseChapterRange', () => {
  it('parses inclusive ranges and singles', () => {
    assert.deepEqual(parseChapterRange('1-3,5', 10), [0, 1, 2, 4])
  })

  it('accepts Chinese separators', () => {
    assert.deepEqual(parseChapterRange('1到10', 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.deepEqual(parseChapterRange('2，4', 10), [1, 3])
  })

  it('clamps to catalog length', () => {
    assert.deepEqual(parseChapterRange('8-20', 10), [7, 8, 9])
  })
})
