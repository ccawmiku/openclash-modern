import test from 'node:test'
import assert from 'node:assert/strict'
import { appendBounded } from '../src/log-buffer.js'
test('log buffer limits both row count and oversized rows while retaining newest', () => {
  assert.deepEqual(appendBounded(['a', 'b'], ['c', 'd'], 3), ['b', 'c', 'd'])
  assert.deepEqual(appendBounded(['long-old-line'], ['short', 'new'], 1500, 10), ['short', 'new'])
  const newest = 'z'.repeat(131072)
  const result = appendBounded(Array(15).fill('x'.repeat(131072)), [newest])
  assert.equal(result.length, 8)
  assert.equal(result.at(-1), newest)
})
