import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('anonymous feed dialog presents distinct global-feed and follow-people paths', async () => {
  const source = await readFile(
    new URL('../src/components/AnonymousFeedDialog.vue', import.meta.url),
    'utf8',
  )

  assert.match(source, /class="anonymous-feed-dialog faro-surface"/)
  assert.match(source, /The global feed is unfiltered/)
  assert.match(source, /Don’t show — I’ll follow people/)
  assert.match(source, /Show the global feed/)
  assert.match(source, /emit\('follow-people'\)/)
  assert.match(source, /emit\('show-feed'\)/)
})
