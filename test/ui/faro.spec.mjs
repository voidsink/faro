import { test, expect } from '@playwright/test'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { matchFilter } from 'nostr-tools/filter'
import { readFile } from 'node:fs/promises'

const ownerKey = new Uint8Array(32).fill(1)
const artistKey = new Uint8Array(32).fill(2)
const friendKey = new Uint8Array(32).fill(3)
const owner = getPublicKey(ownerKey)
const artist = getPublicKey(artistKey)
const friend = getPublicKey(friendKey)
const image = 'https://media.example/photo'
const timestamp = Math.floor(Date.now() / 1000) - 60
const signed = (key, kind, content, tags = []) =>
  finalizeEvent({ kind, content, tags, created_at: timestamp }, key)

async function setup(
  page,
  { signedIn = false, rejectReplies = false, warning = false, offline = false } = {},
) {
  const state = {
    requests: [],
    published: [],
    rejectReplies,
    events: [
      signed(ownerKey, 0, JSON.stringify({ display_name: 'Faro Tester', custom_field: 'keep me' })),
      signed(
        artistKey,
        0,
        JSON.stringify({ display_name: 'Mira', about: 'Photography', banner: `${image}?banner=1` }),
      ),
      signed(friendKey, 0, JSON.stringify({ display_name: 'Alex' })),
      signed(ownerKey, 3, '{"wss://legacy.example":{"read":true}}', [
        ['p', friend, 'wss://legacy.example', 'Alex'],
        ['t', 'nostr'],
      ]),
      signed(artistKey, 20, 'Coastal light #photography', [
        ['title', 'Coastal light'],
        ['imeta', `url ${image}`, 'm image/jpeg'],
        ['imeta', `url ${image}?second=1`, 'm image/jpeg'],
        ['t', 'photography'],
      ]),
      signed(friendKey, 20, 'Harbour morning', [
        ['imeta', `url ${image}`, 'm image/jpeg'],
        ...(warning ? [['content-warning', 'Sensitive photo']] : []),
      ]),
    ],
  }
  await page.route('https://**/*', async (route) => {
    if (route.request().url().startsWith('https://media.example/')) {
      await route.fulfill({
        contentType: 'image/jpeg',
        body: await readFile(new URL('./fixtures/landscape.jpg', import.meta.url)),
      })
    } else if (route.request().url() === 'https://blossom.example/upload') {
      await route.fulfill({ json: { url: image } })
    } else await route.abort()
  })
  await page.routeWebSocket(/^wss:\/\//, (ws) => {
    ws.onMessage((raw) => {
      const [type, id, ...filters] = JSON.parse(raw)
      if (type === 'REQ') {
        if (offline) {
          ws.send(JSON.stringify(['CLOSED', id, 'error: offline']))
          return
        }
        state.requests.push(...filters)
        const events = new Map()
        for (const filter of filters) {
          for (const event of state.events
            .filter((event) => matchFilter(filter, event))
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, filter.limit || 100))
            events.set(event.id, event)
        }
        for (const event of events.values()) ws.send(JSON.stringify(['EVENT', id, event]))
        ws.send(JSON.stringify(['EOSE', id]))
      }
      if (type === 'EVENT') {
        const event = id
        const accepted = !(state.rejectReplies && event.kind === 1)
        if (accepted) {
          state.published.push(event)
          if (event.kind === 0 || event.kind === 3)
            state.events = state.events.filter(
              (old) => old.kind !== event.kind || old.pubkey !== event.pubkey,
            )
          if (!state.events.some((old) => old.id === event.id)) state.events.push(event)
        }
        ws.send(
          JSON.stringify(['OK', event.id, accepted, accepted ? '' : 'blocked: test rejection']),
        )
      }
    })
  })
  await page.exposeFunction('testSignEvent', (event) => finalizeEvent(event, ownerKey))
  await page.addInitScript(
    ({ owner, signedIn }) => {
      localStorage.setItem('faro-blossom-server', JSON.stringify(['https://blossom.example']))
      if (signedIn) {
        localStorage.setItem('faro-identity', JSON.stringify({ pubkey: owner, source: 'nip07' }))
        window.nostr = {
          getPublicKey: async () => owner,
          signEvent: (event) => window.testSignEvent(event),
        }
      }
    },
    { owner, signedIn },
  )
  return state
}

test('mobile tabs route, global-feed consent survives navigation, and no global read happens before consent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page)
  await page.goto('/')
  await expect(page.getByText('The global feed is unfiltered')).toBeVisible()
  expect(state.requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Show the global feed' }).click()
  await expect(page.getByTestId('feed-post')).toHaveCount(2)
  await page.getByRole('tab', { name: 'New post' }).click()
  await expect(page).toHaveURL(/#\/new$/)
  await page.getByRole('tab', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('mobile-settings.png'),
    animations: 'disabled',
    fullPage: true,
  })
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  await expect(page.getByText('The global feed is unfiltered')).not.toBeVisible()
  await expect(page.getByTestId('feed-post')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('mobile-feed.png'),
    animations: 'disabled',
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: test.info().outputPath('desktop-feed.png'),
    animations: 'disabled',
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('photo grids open shareable posts, and failed comments keep their text', async ({ page }) => {
  await setup(page, { signedIn: true, rejectReplies: true })
  await page.goto('/#/tag/photography')
  await page.getByRole('button', { name: 'Coastal light #photography' }).click()
  await expect(page).toHaveURL(/#\/post\/[0-9a-f]{64}$/)
  await expect(page.getByRole('button', { name: 'Show image 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show image 1' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await page.getByRole('button', { name: 'Show image 2' }).click()
  await expect(page.getByRole('button', { name: 'Show image 2' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await page.getByRole('button', { name: 'Comment on post' }).click()
  await page
    .getByRole('textbox', { name: 'Add a comment' })
    .fill('Keep this if the relay rejects it')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  await expect(page.getByText('Comment could not be published to any relay.').first()).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Add a comment' })).toHaveValue(
    'Keep this if the relay rejects it',
  )
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled()
})

test('following and profile edits publish real events and preserve unrelated metadata', async ({
  page,
}) => {
  const state = await setup(page, { signedIn: true })
  await page.goto(`/#/profile/${artist}`)
  await expect(page.getByRole('heading', { name: 'Mira', exact: true })).toBeVisible()
  await expect(page.getByText('No posted photos found yet.')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow on Nostr' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  )
  await page.getByRole('button', { name: 'Follow on Nostr' }).click()
  await expect(page.getByRole('button', { name: 'Unfollow', exact: true })).toBeVisible()
  const contact = state.published.find((event) => event.kind === 3)
  expect(contact.tags).toEqual([
    ['p', friend, 'wss://legacy.example', 'Alex'],
    ['t', 'nostr'],
    ['p', artist],
  ])
  expect(contact.content).toBe('{"wss://legacy.example":{"read":true}}')
  await page.goto('/#/profile')
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('New Faro Name')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('heading', { name: 'New Faro Name', exact: true })).toBeVisible()
  const metadata = JSON.parse(state.published.find((event) => event.kind === 0).content)
  expect(metadata.custom_field).toBe('keep me')
})

test('guest composer offers sign-in, requires key backup, protects drafts and publishes kind 20', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page)
  await page.goto('/#/new')
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(new URL('../../public/icons/favicon-96x96.png', import.meta.url).pathname)
  await expect(page.getByRole('button', { name: 'Original', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Caption', exact: true })
    .fill('My Faro photo #photography')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('link', { name: 'Close composer' }).click()
  await expect(page).toHaveURL(/#\/new$/)
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await page.locator('.post-stepper').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Create a Nostr account' }).click()
  await expect(page.getByRole('heading', { name: 'Keep your Nostr key safe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to Faro' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'I saved my key somewhere safe' }).check()
  await page.getByRole('button', { name: 'Continue to Faro' }).click()
  // A generated account signs locally; all relay and upload traffic is intercepted.
  await page.getByRole('button', { name: 'Publish to Nostr' }).click()
  await expect(page).toHaveURL(/#\/$/)
  const event = state.published.find((event) => event.kind === 20)
  expect(event.content).toBe('My Faro photo #photography')
  expect(event.tags.some((tag) => tag[0] === 'imeta')).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem('faro-identity'))).toBeNull()
})

test('shared header navigates between pages without duplicate page navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const state = await setup(page, { signedIn: true })
  await page.goto('/#/profile')
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeVisible()
  await expect(page.locator('main').getByLabel('Home', { exact: true })).toHaveCount(0)
  await expect(page.locator('main').getByText('Settings', { exact: true })).toHaveCount(0)
  const header = page.locator('.faro-header')
  for (const width of [390, 882, 1440]) {
    await page.setViewportSize({ width, height: 884 })
    await expect(page.locator('.faro-header-inner')).toHaveCSS('padding-bottom', '0px')
    await expect(header).toHaveCSS('height', '86px')
  }
  await header.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('listitem', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(header).toBeVisible()
  await header.getByLabel('New post', { exact: true }).click()
  await expect(page).toHaveURL(/#\/new$/)
  await expect(header).toBeVisible()
  await header.getByLabel('Home', { exact: true }).click()
  await expect(page).toHaveURL(/#\/$/)
  for (const path of [
    `/tag/photography`,
    `/post/${state.events.find((event) => event.kind === 20).id}`,
  ]) {
    await page.goto(`/#${path}`)
    await expect(header).toBeVisible()
    await expect(page.locator('main').getByLabel('Home', { exact: true })).toHaveCount(0)
  }
})

test('content warnings hide feed media until explicitly revealed', async ({ page }) => {
  await setup(page, { signedIn: true, warning: true })
  await page.goto('/')
  await expect(page.getByText('Content warning: Sensitive photo')).toBeVisible()
  await expect(page.getByTestId('feed-post').locator('img.feed-image')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show media' }).click()
  await expect(page.getByTestId('feed-post').locator('img.feed-image')).toHaveCount(1)
})

test('relay outages show a retry action instead of an empty feed', async ({ page }) => {
  await setup(page, { signedIn: true, offline: true })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Could not reach your Nostr relays')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByTestId('empty-feed')).not.toBeVisible()
})

test('an unreachable contact list never gets overwritten by Follow', async ({ page }) => {
  const state = await setup(page, { signedIn: true, offline: true })
  await page.goto(`/#/profile/${artist}`)
  await page.getByRole('button', { name: 'Follow on Nostr' }).click()
  await expect(
    page
      .getByText('Could not reach your Nostr relays. Check your connection or relay settings.')
      .first(),
  ).toBeVisible()
  expect(state.published).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Follow on Nostr' })).toBeEnabled()
})

test('refreshing without new posts still allows loading older photos', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 })
  const state = await setup(page, { signedIn: true })
  for (let index = 1; index <= 3; index++) {
    state.events.push(
      finalizeEvent(
        {
          kind: 20,
          created_at: timestamp - index * 10,
          content: `Recent photo ${index}`,
          tags: [['imeta', `url ${image}`, 'm image/jpeg']],
        },
        friendKey,
      ),
    )
  }
  state.events.push(
    finalizeEvent(
      {
        kind: 20,
        created_at: timestamp - 45 * 86400,
        content: 'Older photo',
        tags: [['imeta', `url ${image}`, 'm image/jpeg']],
      },
      friendKey,
    ),
  )
  await page.goto('/')
  await expect(page.getByTestId('feed-post')).toHaveCount(4)
  await page.getByRole('button', { name: 'Refresh Nostr feed' }).click()
  await expect(page.getByText(/Nostr refresh complete:/)).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(page.getByTestId('feed-post')).toHaveCount(5)
  await expect(page.getByText('Older photo')).toBeVisible()
})

test('theme preference persists and System follows device changes', async ({ page }) => {
  await setup(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/#/settings')
  const selectTheme = async (name) => {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).click()
    await page.getByRole('option', { name, exact: true }).click()
  }
  await expect(page.locator('body')).toHaveClass(/body--light/)
  await selectTheme('Dark')
  await expect(page.locator('body')).toHaveClass(/body--dark/)
  await page.reload()
  await expect(page.locator('body')).toHaveClass(/body--dark/)
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('Dark')
  await selectTheme('Light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('body')).toHaveClass(/body--light/)
  await selectTheme('System')
  await expect(page.locator('body')).toHaveClass(/body--dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('body')).toHaveClass(/body--light/)
  expect(await page.evaluate(() => localStorage.getItem('faro-theme'))).toBe('system')
  await page.evaluate(() => localStorage.setItem('faro-theme', 'invalid'))
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('System')
})

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
]) {
  test(`theme contrast, interaction states and matching ${viewport.name} screenshots`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await setup(page)
    await page.goto('/')
    await expect(page.getByText('The global feed is unfiltered')).toBeVisible()
    await expect(page.locator('body')).toHaveClass(new RegExp(`body--${testInfo.project.name}`))
    const capture = async (name) => {
      await expect(page.locator('.faro-header .q-toolbar')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.screenshot({
        path: testInfo.outputPath(`${viewport.name}-${name}.png`),
        animations: 'disabled',
      })
    }
    await capture('onboarding')
    await page.getByRole('button', { name: 'Show the global feed' }).click()
    await expect(page.getByTestId('feed-post')).toHaveCount(2)
    await expect(page.locator('img.feed-image').first()).toBeVisible()
    await page
      .locator('img.feed-image')
      .first()
      .evaluate((img) => img.decode())
    await capture('feed')
    const ratios = await page.evaluate(() => {
      const color = (token) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`
        document.body.append(probe)
        const rgb = getComputedStyle(probe)
          .color.match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
        probe.remove()
        return rgb
      }
      const luminance = (rgb) =>
        rgb
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
      const contrast = (a, b) => {
        const x = luminance(a),
          y = luminance(b)
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
      }
      return {
        text: contrast(color('--faro-ink'), color('--faro-surface-bg')),
        muted: contrast(color('--faro-muted'), color('--faro-surface-bg')),
        links: contrast(color('--faro-link'), color('--faro-surface-bg')),
        chips: contrast(color('--faro-link'), color('--faro-accent-soft')),
        primary: contrast([255, 255, 255], color('--q-primary')),
        focus: contrast(color('--faro-link'), color('--faro-canvas')),
        controls: contrast(color('--faro-control-border'), color('--faro-surface-bg')),
      }
    })
    for (const role of ['text', 'muted', 'links', 'chips', 'primary'])
      expect(ratios[role], role).toBeGreaterThanOrEqual(4.5)
    for (const role of ['focus', 'controls']) expect(ratios[role], role).toBeGreaterThanOrEqual(3)
    await page.getByRole('textbox', { name: 'Find a person or topic' }).focus()
    await expect(page.locator('.feed-search')).toHaveClass(/q-field--focused/)
    await expect(page.locator('.feed-search .q-field__control')).toHaveCSS(
      'color',
      testInfo.project.name === 'dark' ? 'rgb(196, 175, 255)' : 'rgb(109, 40, 217)',
    )
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true }).first()
    await page.keyboard.press('Shift+Tab')
    await expect(signIn).toBeFocused()
    await expect(signIn).toHaveCSS('outline-style', 'solid')
    await signIn.hover()
    await signIn.click()
    await expect(page.getByText('Sign in to Faro', { exact: true })).toBeVisible()
    await expect(page.locator('.login-card')).toHaveCSS('outline-style', 'none')
    await page.getByText('Other login methods', { exact: true }).click()
    const bunker = page.getByRole('textbox', { name: 'Paste remote signer / bunker URL' })
    await bunker.focus()
    await expect(bunker).toHaveCSS('outline-style', 'none')
    await expect(page.locator('.login-card .q-field').filter({ has: bunker })).toHaveClass(
      /q-field--focused/,
    )
    const nsec = page.getByLabel('Paste nsec private key', { exact: true })
    await nsec.fill('test-private-key')
    await expect(nsec).toHaveCSS('outline-style', 'none')
    await capture('login')
    await page.getByRole('button', { name: 'Close login' }).click()
    await page.goto('/#/settings')
    await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toBeVisible()
    await capture('settings')
    await page.goto(`/#/profile/${artist}`)
    await expect(page.getByRole('heading', { name: 'Mira', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Coastal light #photography' })).toBeVisible()
    await capture('profile')
    await page.goto('/#/new')
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles(new URL('./fixtures/landscape.jpg', import.meta.url).pathname)
    await expect(page.getByRole('button', { name: 'Original', exact: true })).toBeVisible()
    await capture('composer')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const caption = page.getByRole('textbox', { name: 'Caption', exact: true })
    await caption.fill('A photo caption')
    await expect(caption).toHaveCSS('outline-style', 'none')
    await expect(page.locator('.post-stepper .q-field')).toHaveClass(/q-field--focused/)
    await capture('caption')
    await page.getByRole('button', { name: 'Review', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save locally' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publish to Nostr' })).toBeVisible()
    await capture('review')
  })
}
