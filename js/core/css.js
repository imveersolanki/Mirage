/* Mirage core: build the exported stylesheet from the CSS files as text.
   The editor does the same from the live CSSOM (collectCSS in mirage.js);
   this version is for Node: the CLI and the @mirage/ui build. */

/* split CSS text into rules; at-rules with blocks keep their inner rules */
export function parseCSS(text){
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  function block(){
    const out = [];
    while(i < text.length){
      while(i < text.length && /\s/.test(text[i])) i++;
      if(i >= text.length || text[i] === '}'){ i++; return out; }
      let start = i, depth = 0, q = null;
      while(i < text.length){
        const c = text[i];
        if(q){ if(c === q && text[i-1] !== '\\') q = null; }
        else if(c === '"' || c === "'") q = c;
        else if(c === '(') depth++;
        else if(c === ')') depth--;
        else if(depth === 0 && (c === '{' || c === ';')) break;
        i++;
      }
      const head = text.slice(start, i).trim();
      if(text[i] === ';'){ i++; if(head) out.push({at: head}); continue; }
      i++; // {
      if(/^@(media|container|supports)/.test(head)) out.push({at: head, rules: block()});
      else if(/^@(-webkit-)?keyframes/.test(head)){ const s = i; let d = 1; while(i < text.length && d){ if(text[i]==='{') d++; else if(text[i]==='}') d--; i++; } out.push({frames: head + '{' + text.slice(s, i-1) + '}'}); }
      else { const s = i; let d = 1, qq = null; while(i < text.length && d){ const c = text[i]; if(qq){ if(c===qq) qq=null; } else if(c==='"'||c==="'") qq=c; else if(c==='{') d++; else if(c==='}') d--; i++; } out.push({sel: head, body: text.slice(s, i-1).trim()}); }
    }
    return out;
  }
  return block();
}

const ED = /\.cx\b|\.void\b|\.ed\b|\[data-drop\]|\.over\b/;
/* keep output rules (and only the chosen theme), rewritten to hang off .page */
export function exportCSS(files, opts){
  opts = opts || {};
  const theme = opts.theme || '', all = !!opts.allThemes;
  const wanted = sel => {
    if(ED.test(sel)) return false;
    const th = sel.match(/\.th-([a-z0-9_-]+)/);
    if(th) return all || th[1] === theme;
    return /#sheet|\.c-|\.sh-|\.bt\b|\.al-/.test(sel);
  };
  const rewrite = sel => sel.split(',').map(s => {
    s = s.trim().replace(/#sheet\.th-([a-z0-9_-]+)/g, '.page.th-$1').replace(/#sheet/g, '.page');
    if(s.indexOf('.page') !== 0 && /^(\.c-|\.sh-|\.bt|\.al-)/.test(s)) s = '.page ' + s;
    return s;
  }).join(', ');
  const keep = [], frames = [];
  const walk = (rules, into) => rules.forEach(r => {
    if(r.frames){ if(/@keyframes (cin|livep)\b/.test(r.frames)) return; frames.push(r.frames); return; }   // skip editor-only animations
    if(r.rules){
      const inner = [];
      walk(r.rules, inner);
      if(!inner.length) return;
      const cond = r.at.replace(/^@container\s+page\s*/, '@media ').replace(/^@container\s*/, '@media ');
      into.push(cond + '{\n  ' + inner.join('\n  ') + '\n}');
      return;
    }
    if(!r.sel || !wanted(r.sel)) return;
    into.push(rewrite(r.sel) + '{' + r.body + '}');
  });
  files.forEach(t => walk(parseCSS(t), keep));
  return {rules: keep, frames};
}

/* Google Fonts @import for the display and body fonts the theme uses */
export function fontImport(cssText){
  const names = new Set(['IBM Plex Mono']);
  (cssText.match(/--c-f[db]\s*:\s*[^;}]+/g) || []).forEach(d => {
    d.replace(/^--c-f[db]\s*:\s*/, '').split(',').forEach(p => {
      const nm = p.trim().replace(/^["']|["']$/g, '');
      if(/^[A-Z]/.test(nm) && !/^(Georgia|Arial|Helvetica|Didot|Bodoni|Times|system-ui)/.test(nm)) names.add(nm);
    });
  });
  return "@import url('https://fonts.googleapis.com/css2?" +
    [...names].map(n => 'family=' + n.replace(/ /g, '+') + ':wght@400;500;600;700;800;900').join('&') + "&display=swap');\n\n";
}

export function designCSS(d){
  return ['--c-bg:'+d.bg, '--c-fg:'+d.fg, '--c-mut:'+d.mut, '--c-line:'+d.line, '--c-acc:'+d.acc,
    '--c-r:'+d.radius+'px', '--c-bw:'+d.border+'px', '--c-pad:'+d.pad+'px', '--c-sh:'+d.shadow,
    '--c-tt:'+(d.track/1000)+'em', '--c-hw:'+d.weight, '--c-fd:"'+d.fontD+'", sans-serif', '--c-fb:"'+d.fontB+'", sans-serif']
    .map(x => '  '+x+';').join('\n');
}
