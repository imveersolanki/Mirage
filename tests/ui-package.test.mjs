/* the React package carries its own copy of the default text; it must not drift from core */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { D } from '../js/core/content.js';

test('@mirage/ui defaults match the editor', () => {
  const src = fs.readFileSync(new URL('../packages/ui/src/index.jsx', import.meta.url), 'utf8');
  const json = src.slice(src.indexOf('export const DEFAULTS = ')+24, src.indexOf('};', src.indexOf('export const DEFAULTS'))+1);
  assert.deepEqual(JSON.parse(json), JSON.parse(JSON.stringify(D)));
});
test('@mirage/ui exports a component for every type', () => {
  const src = fs.readFileSync(new URL('../packages/ui/src/index.jsx', import.meta.url), 'utf8');
  for(const c of ['Row','Group','Nav','Hero','CardGrid','Prose','Figure','Gallery','Rail','Stats','LogoRow','Quote','Form','DataTable','Tabs','Pricing','Banner','CodeBlock','Button','Footer','Raw'])
    assert.ok(new RegExp('export function '+c+'\\b').test(src), c);
});
