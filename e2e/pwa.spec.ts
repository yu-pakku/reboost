import { test, expect, type Page } from '@playwright/test';
async function waitForCache(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return false;
    return new Promise<boolean>(resolve => {
      const channel = new MessageChannel();
      const finish = (ready: boolean) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(ready);
      };
      const timer = window.setTimeout(() => finish(false), 1000);
      channel.port1.onmessage = event => finish(event.data?.ready === true);
      worker.postMessage({ type: 'PWA_STATUS' }, [channel.port2]);
    });
  })).toBe(true);
}
async function ready(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'さあ、始めよう' }).click();
  await expect(page.getByRole('link', { name: '知識を追加' })).toBeVisible();
  await waitForCache(page);
}
async function create(page: Page, term = 'HTTP') {
  await page.goto('/knowledge/new'); await page.getByLabel('用語 必須', { exact: true }).fill(term); await page.getByLabel('意味・説明 必須', { exact: true }).fill('Web通信で利用されるプロトコル'); await page.getByLabel('穴埋めにする文字 必須', { exact: true }).fill('プロトコル'); await page.getByRole('radio').check(); await page.getByRole('button', { name: '知識を保存', exact: true }).click(); await expect(page.getByRole('heading', { name: term, exact: true })).toBeVisible();
}
test('manifest・アイコン配信とSWによるオフライン準備', async ({ page, request }) => {
  const response = await request.get('/manifest.webmanifest'); expect(response.status()).toBe(200); const manifest = await response.json(); expect(manifest).toMatchObject({ name: 'ReBoost', short_name: 'ReBoost', display: 'standalone' });
  for (const [path, size] of [['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512], ['/icons/maskable-512.png', 512], ['/apple-touch-icon.png', 180]] as const) {
    const result = await request.get(path); expect(result.headers()['content-type']).toContain('image/png'); const png = await result.body(); expect(png.readUInt32BE(16)).toBe(size); expect(png.readUInt32BE(20)).toBe(size);
  }
  const worker = await request.get('/sw.js'); expect(worker.headers()['cache-control']).toContain('no-store'); expect(worker.headers()['service-worker-allowed']).toBe('/');
  await ready(page); expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/apple-touch-icon.png');
});
test('未訪問の動的画面を含め、オフラインで登録・編集・学習・再読込・JSON保存を行う', async ({ page, context }) => {
  await ready(page); await context.setOffline(true); await create(page); const detail = new URL(page.url()).searchParams.get('route')!; expect(detail).toMatch(/^\/knowledge\//);
  await expect(page.getByText('オフライン：この端末に保存した知識を利用できます。')).toBeVisible();
  await page.getByRole('link', { name: '内容を編集' }).click(); await page.getByLabel('用語 必須', { exact: true }).fill('HTTP改'); await page.getByRole('button', { name: '変更を保存' }).click(); await page.getByRole('button', { name: '進捗リセットを確認して保存' }).click(); await expect(page.getByRole('heading', { name: 'HTTP改', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '復習一覧へ →' }).click(); await page.getByRole('button', { name: 'HTTP改を復習' }).click(); await page.getByRole('button', { name: '確認した', exact: true }).click(); await expect(page.getByText('次の状態：Level 1・成功1回')).toBeVisible();
  await page.goto(detail); await page.reload(); await expect(page.getByText('Level 1・成功1回', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: '知識', exact: true }).click(); await page.getByRole('link', { name: '設定', exact: true }).click(); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'JSONをエクスポート' }).click(); const download = await downloadPromise; const file = await download.path(); expect(file).toBeTruthy();
  await page.getByLabel('バックアップから復元（10MB以下）').setInputFiles(file!); await page.getByRole('button', { name: '確認した内容を追加して復元' }).click(); await expect(page.getByText('復元しました：追加0件、同一内容のスキップ1件。')).toBeVisible();
  await context.setOffline(false); await expect(page.getByText('オフライン：この端末に保存した知識を利用できます。')).toHaveCount(0);
});
test('320px・390pxの表示と入力サイズ・セーフエリア用余白', async ({ page }) => {
  await ready(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    for (const path of ['/', '/knowledge/new', '/review', '/settings', '/account']) {
      await page.goto(path); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto('/knowledge/new'); await expect(page.locator('nav')).toHaveCount(0); expect(await page.locator('#term').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px'); await page.locator('#term').focus(); expect(await page.locator('main').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThan(100);
  }
});
test('新しいSWの明示的な適用後もIndexedDBと入力を保持する', async ({ page }) => {
  const { readFile, writeFile } = await import('node:fs/promises');
  await ready(page); await create(page); await page.goto('/knowledge/new'); await page.getByLabel('用語 必須', { exact: true }).fill('まだ保存していない入力');
  const original = await readFile('public/sw.js', 'utf8');
  try {
    await writeFile('public/sw.js', original.replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-browser-test"'));
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration?.update(); });
    await expect(page.getByRole('button', { name: '保存後に更新する' })).toBeVisible(); await expect(page.getByLabel('用語 必須', { exact: true })).toHaveValue('まだ保存していない入力');
    // The notice must never apply itself. User chooses when unfinished input may be discarded.
    await page.getByRole('button', { name: '保存後に更新する' }).click(); await waitForCache(page);
    await page.goto('/knowledge'); await expect(page.getByRole('heading', { name: 'HTTP', exact: true })).toBeVisible();
  } finally { await writeFile('public/sw.js', original); }
});

test('初回導入は小画面と動きの軽減に対応し、再読み込み後にホームを開く', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const start = page.getByRole('button', { name: 'さあ、始めよう' });
  await expect(start).toBeInViewport();
  await expect(page.locator('.sample-particle').first()).toHaveCSS('animation-name', 'none');
  await start.click();
  const add = page.getByRole('link', { name: '知識を追加' });
  for (const [width, height] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect(add).toBeInViewport();
    await expect(page.getByRole('navigation')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.reload();
  await expect(add).toBeVisible();
  await expect(start).toHaveCount(0);
  await expect(page.locator('[data-particle-id]')).toHaveCount(0);
});

test('登録から最終合格まで進め、実績を1受験、定着を1結晶として表示する', async ({ page }) => {
  const start = Date.parse('2026-12-31T14:59:30Z');
  await page.clock.setFixedTime(start);
  await ready(page);
  await create(page);
  for (const [day, level] of [[0, 1], [1, 1], [2, 2], [3, 2], [5, 3], [7, 3]]) {
    await page.clock.setFixedTime(start + day * 86400000);
    await page.goto('/review');
    await page.getByRole('button', { name: 'HTTPを復習' }).click();
    if (level === 1) await page.getByRole('button', { name: '確認した', exact: true }).click();
    else {
      await page.getByRole('textbox').fill(level === 2 ? 'HTTP' : 'プロトコル');
      await page.getByRole('button', { name: '回答する', exact: true }).click();
    }
    await expect(page.getByRole('region', { name: '回答結果' })).toBeVisible();
  }
  // The final completion is 30 seconds after the JST date boundary.
  await page.clock.setFixedTime(start + 10 * 86400000 + 60000);
  await page.goto('/review');
  await page.getByRole('link', { name: '最終テストへ' }).click();
  await page.getByRole('button', { name: '2問のテストを開始' }).click();
  await page.getByRole('textbox', { name: '用語を入力' }).fill('HTTP');
  await page.getByRole('button', { name: '回答を確定して次へ' }).click();
  await page.getByRole('textbox', { name: '穴埋めの答えを入力' }).fill('プロトコル');
  await page.getByRole('button', { name: '全問の回答を送信' }).click();
  await expect(page.getByRole('heading', { name: '定着達成！' })).toBeVisible();
  await page.getByRole('link', { name: 'ホームへ' }).click();
  await expect(page.locator('[data-particle-id]')).toHaveCount(1);
  await page.getByRole('navigation').getByRole('link', { name: '復習', exact: true }).click();
  const calendar = page.getByRole('region', { name: '選択した日の詳細' });
  await expect(calendar.getByText('最終テスト・合格')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /2027年1月11日、実績1件、予定0件/ })).toHaveAttribute('aria-current', 'date');
  await page.getByRole('navigation').getByRole('link', { name: '知識', exact: true }).click();
  await page.getByRole('button', { name: '定着済み', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'HTTP', exact: true })).toBeVisible();
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'JSONをエクスポート' })).toBeEnabled();
});
