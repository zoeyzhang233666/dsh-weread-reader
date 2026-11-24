import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createReadingClock } from '../packages/host/src/reading.js'

describe('createReadingClock', () => {
  it('accrues focused seconds', () => {
    let now = 1_000
    const clock = createReadingClock(() => now)
    clock.focus()
    now += 3_500
    assert.equal(clock.takeSeconds(), 3)
    now += 1_200
    assert.equal(clock.takeSeconds(), 1)
  })
})
