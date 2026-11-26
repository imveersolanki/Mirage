import { test, expect } from '@playwright/test';

const fresh = async page => {
  await page.goto('/mirage');
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('mirage'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.goto('/mirage');
  await expect(page.locator('#blank')).toBeVisible();
};
const errors = page => { const e = []; page.on('pageerror', x => e.push(String(x))); return e; };

test('a preset builds a page and undo works', async ({ page }) => {
  const errs = errors(page); await fresh(page);
  await page.click('[data-preset=landing]');
  await expect(page.locator('#sheet .c-nav')).toBeVisible();
  await expect(page.locator('#stBox')).toHaveText('9');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#stBox')).toHaveText('0');
  expect(errs).toEqual([]);
});

test('drawing a box, then alt-drawing inside it makes a group', async ({ page }) => {
  await fresh(page);
  const cv = await page.locator('#sk').boundingBox(), cell = await page.evaluate(() => Mirage.cell);
  const drag = async (x0,y0,x1,y1,alt) => { if(alt) await page.keyboard.down('Alt');
    await page.mouse.move(cv.x+cell*x0, cv.y+cell*y0); await page.mouse.down(); await page.mouse.move(cv.x+cell*x1, cv.y+cell*y1, {steps:6}); await page.mouse.up();
    if(alt) await page.keyboard.up('Alt'); };
  await drag(0.2, 2.2, 15.8, 9.8);
  await drag(1.3, 3.3, 7.7, 8.7, true);
  expect(await page.evaluate(() => Mirage.classify().list.map(b => b.type))).toContain('group');
  await expect(page.locator('#sheet .c-group')).toBeVisible();
});

test('inline text edits survive export', async ({ page }) => {
  await fresh(page); await page.click('[data-preset=landing]');
  const h = page.locator('#sheet .c-hero .ed').first();
  await h.click(); await page.keyboard.press('Control+a'); await page.keyboard.type('Bread by eight'); await page.keyboard.press('Enter');
  await page.click('#bExport'); await page.click('#segFmt [data-f=html]');
  await expect(page.locator('#codeOut')).toContainText('<h1>Bread by eight</h1>');
});

test('pages, share link round trip', async ({ page, context }) => {
  await fresh(page); await page.click('[data-preset=landing]');
  await page.click('#pageTabs .add');
  await expect(page.locator('#pageTabs .pt')).toHaveCount(3);
  await page.click('#bShare');
  await expect(page.locator('#shareUrl')).toHaveValue(/#s=/);
  const url = await page.inputValue('#shareUrl');
  const other = await context.newPage(); await other.goto(url);
  await expect.poll(() => other.evaluate(() => Mirage.pages.length)).toBe(2);
});

test('opening a committed sketch file', async ({ page }) => {
  await fresh(page); await page.click('#bProjects');
  await page.setInputFiles('#openJson', 'tests/fixtures/bakery.json');
  await expect(page.locator('#sheet .c-hero')).toContainText('Sourdough');
  await expect(page.locator('#sheet figure.has-img img').first()).toHaveAttribute('alt', /loaf/);
  await expect(page.locator('#chkN')).toHaveText('✓');
});

test('two tabs in a live session merge edits to different boxes', async ({ page, context }) => {
  await context.route('https://unpkg.com/**', r => r.abort());
  await fresh(page); await page.click('[data-preset=landing]');
  await page.click('#bLive'); await page.click('#bLiveStart');
  const url = await page.inputValue('#liveUrl'); await page.keyboard.press('Escape');
  const b = await context.newPage(); await b.goto(url);
  await expect.poll(() => b.evaluate(() => Mirage.boxes.length)).toBe(9);
  await Promise.all([
    page.evaluate(() => { Mirage.boxes[1].c = {heroH:'From A'}; Mirage.commit(true); }),
    b.evaluate(() => { Mirage.boxes[7].c = {banner:'From B'}; Mirage.commit(true); }),
  ]);
  for(const p of [page, b]) await expect.poll(() => p.evaluate(() => [Mirage.boxes[1].c && Mirage.boxes[1].c.heroH, Mirage.boxes[7].c && Mirage.boxes[7].c.banner].join('|'))).toBe('From A|From B');
});

test('importing a photo of a sketch finds the boxes', async ({ page }) => {
  await fresh(page); await page.click('#bImport');
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 900; const x = c.getContext('2d');
    x.fillStyle = '#f3efe6'; x.fillRect(0,0,1200,900); x.translate(600,450); x.rotate(5*Math.PI/180); x.translate(-600,-450);
    x.strokeStyle = '#222'; x.lineWidth = 4;
    [[100,80,1000,60],[100,170,1000,280],[100,480,320,200],[440,480,320,200],[780,480,320,200],[100,710,1000,70]].forEach(r => x.strokeRect(...r));
    const im = new Image(); im.src = c.toDataURL(); await im.decode();
    Mirage.importImage(im, 'sketch'); return Mirage.importState();
  });
  expect(r.found.length).toBe(6);
  expect(Math.abs(r.angle - 5)).toBeLessThan(1);
});
