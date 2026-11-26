/* every added style must be readable: body, secondary text and buttons at 4.5:1 or better */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const L = h => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(x => x <= .03928 ? x/12.92 : ((x+.055)/1.055)**2.4);
  return .2126*c[0] + .7152*c[1] + .0722*c[2]; };
const ratio = (a,b) => { const x = L(a), y = L(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const css = ['themes-extra.css','themes-looks.css'].map(f => fs.readFileSync(new URL('../css/'+f, import.meta.url), 'utf8')).join('\n');
const themes = [...css.matchAll(/#sheet\.th-([a-z-]+)\{([^}]*)\}/g)].filter(m => /--c-bg:#/.test(m[2]));

test('there are 65 added styles (19 + 46 looks)', () => assert.equal(themes.length, 65));
test('no style is defined twice', () => {
  const all = ['themes.css','themes-extra.css','themes-looks.css','mirage.css'].map(f => fs.readFileSync(new URL('../css/'+f, import.meta.url), 'utf8')).join('\n');
  const names = [...all.matchAll(/#sheet\.th-([a-z0-9-]+)\{[^}]*--c-bg/g)].map(m => m[1]);
  assert.deepEqual(names.filter((n,i) => names.indexOf(n)!==i), []);
});
for(const [, name, body] of themes){
  const v = k => (body.match(new RegExp(k+':(#[0-9A-Fa-f]{6})')) || [])[1];
  test('style "'+name+'" passes contrast', () => {
    for(const k of ['--c-fg','--c-mut','--c-acc']) assert.ok(ratio(v(k), v('--c-bg')) >= 4.5, name+' '+k+' '+ratio(v(k), v('--c-bg')).toFixed(2));
  });
}
test('every added style is offered in the editor', () => {
  const html = fs.readFileSync(new URL('../mirage/index.html', import.meta.url), 'utf8');
  for(const [, name] of themes) assert.ok(html.includes('value="'+name+'"'), name);
});
