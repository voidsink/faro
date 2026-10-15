import test from 'node:test'
import assert from 'node:assert/strict'
import { formatDate } from '../src/utils/date.js'

test('feed dates handle invalid, future and relative timestamps', () => {
  const now = Date.now()
  assert.equal(formatDate('invalid'), '')
  assert.equal(formatDate(now + 60_000), 'now')
  assert.equal(formatDate(now - 12 * 60_000), '12m')
  assert.equal(formatDate(now - 3 * 3_600_000), '3h')
  assert.equal(formatDate(now - 2 * 86_400_000), '2d')
  assert.match(formatDate('2020-01-01'), /2020/)
})
