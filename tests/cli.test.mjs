import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const CLI = new URL('../cli/mirage.mjs', import.meta.url).pathname;
const FIX = new URL('./fixtures/bakery.json', import.meta.url).pathname;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mirage-'));

test('builds a static site with pages, assets, sitemap', () => {
  const out = tmp();
  execFileSync('node', [CLI, 'build', FIX, '--target', 'site', '--out', out]);
  for(const f of ['index.html','our-loaves.html','mirage.css','sitemap.xml','robots.txt']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.ok(html.includes('<meta name="description"'));
  assert.ok(html.includes('<a href="our-loaves.html">Our loaves</a>'));
  assert.equal(fs.readdirSync(path.join(out, 'assets')).length, 2);
  const css = fs.readFileSync(path.join(out, 'mirage.css'), 'utf8');
  assert.ok(css.includes('.page .c-hero') && css.includes('.page.th-__custom') && css.includes('.page .c-x-faq'));
  assert.ok(!css.includes('#app') && !css.includes('#sheet'));
});
test('every target builds', () => {
  for(const t of ['html','react','next','tailwind','json']){
    const out = tmp();
    execFileSync('node', [CLI, 'build', FIX, '--target', t, '--out', out]);
    assert.ok(fs.readdirSync(out).length, t);
  }
});
test('check passes the fixture and fails a sketch with an image missing alt text', () => {
  assert.equal(spawnSync('node', [CLI, 'check', FIX]).status, 0);
  const bad = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const img = bad.pages[0].boxes.find(b => b.c && b.c['img:src']); delete img.c['img:alt'];
  const f = path.join(tmp(), 'bad.json'); fs.writeFileSync(f, JSON.stringify(bad));
  const r = spawnSync('node', [CLI, 'check', f]);
  assert.equal(r.status, 1); assert.ok(String(r.stdout).includes('without alt text'));
});
test('unknown target is a clear error', () => {
  const r = spawnSync('node', [CLI, 'build', FIX, '--target', 'php']);
  assert.equal(r.status, 2); assert.ok(String(r.stderr).includes('unknown target'));
});
