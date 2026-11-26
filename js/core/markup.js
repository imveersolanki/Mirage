/* Mirage core: one markup generator for the live preview and every export.
   edit:true adds contenteditable spans for the preview; otherwise it is clean,
   accessible HTML. Pure string building, so it also runs in Node. */
import { D, NICE, MULTI, SHAPED, ALIGNABLE, FIELD_RE, fieldsFor } from './content.js';

export const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

export const TAG = {nav:'nav', hero:'header', footer:'footer', image:'figure', quote:'figure',
  form:'form', sidebar:'aside', code:'div', table:'div'};
export const RMAP = {nav:'Nav', hero:'Hero', cards:'CardGrid', text:'Prose', image:'Figure', gallery:'Gallery',
  sidebar:'Rail', stats:'Stats', logos:'LogoRow', quote:'Quote', form:'Form', table:'DataTable',
  tabs:'Tabs', price:'Pricing', banner:'Banner', code:'CodeBlock', button:'Button', footer:'Footer', group:'Group'};

export const txt = (b,k,fb) => (b.c && b.c[k]!=null && b.c[k]!=='') ? b.c[k] : fb;
export const alignClass = b => (ALIGNABLE.indexOf(b.type)<0 || !b.align || b.align==='start') ? '' : ' al-'+b.align;
export const shapeClass = b => b.shape && b.shape!=='rect' ? ' sh-'+b.shape : '';
/* responsive flags: hide:['t','p'], first:true on a box; stack:'t'|'keep' on a row */
export function rspClass(b){
  let c = '';
  if(b.hide && b.hide.indexOf('t')>=0) c += ' c-hide-t';
  if(b.hide && b.hide.indexOf('p')>=0) c += ' c-hide-p';
  if(b.first) c += ' c-first';
  return c;
}
export const rowClass = items => { const l = items[0]||{}; return l.stack==='t' ? ' c-stack-t' : (l.stack==='keep' ? ' c-keep' : ''); };
const addCls = (html, cls) => cls ? html.replace('class="', 'class="'+cls.trim()+' ') : html;

/* env: {classify(arr), pageNames(), links(), asset(ref), custom(key)} */
export function createMarkup(env){
  const custom = k => (env.custom ? env.custom(k) : null);
  const pageNames = () => (env.pageNames ? env.pageNames() : []);
  const asset = r => (env.asset ? env.asset(r) : r);

  function laidRows(arr){
    const {list, rows} = env.classify(arr);
    list.forEach((b,i) => { b._i = i; });
    const lay = rs => rs.map(r => ({items: r.items.map(o => list[o.i]).filter(b => !b.merged).map(b => {
      if(b.type==='group') b.rows = lay(b.kids||[]);
      return b;
    })})).filter(r => r.items.length);
    return lay(rows);
  }

  function mkInner(b, pad, o){
    const n = clamp(b.cells||3, 2, 6), sc = shapeClass(b), al = alignClass(b);
    const P = s => pad+s;
    const T = (k, fb) => {
      const v = txt(b, k, fb);
      return o.edit ? '<span class="ed" contenteditable="true" spellcheck="false" data-b="'+b._i+'" data-k="'+esc(k)+'">'+esc(v)+'</span>' : esc(v);
    };
    const plain = (k, fb) => esc(txt(b, k, fb));
    const t = TAG[b.type] || 'section';
    const wrap = (cls, inner, attrs) => P('<'+t+' class="'+cls+'"'+(attrs||'')+'>')+'\n'+
      inner.split('\n').map(l => pad+'  '+l).join('\n')+'\n'+P('</'+t+'>');
    const st = o.st || (o.st = {});
    const heading = kind => {           // one h1 per page: the first hero, or the first heading if there is no hero
      if(kind==='hero' && !st.h1){ st.h1 = true; return 'h1'; }
      if(kind!=='hero' && st.promote && !st.h1){ st.h1 = true; return 'h1'; }
      return kind==='card' ? 'h3' : 'h2';
    };
    const img = (k, minH) => {
      const src = b.c && b.c[k+':src'], alt = (b.c && b.c[k+':alt']) || '';
      const drop = o.edit ? ' data-drop="'+b._i+'" data-dk="'+k+'"' : '';
      const style = minH ? ' style="min-height:'+minH+'px"' : '';
      if(src) return '<figure class="c-img has-img'+sc+'"'+style+drop+'><img src="'+esc(asset(src))+'" alt="'+esc(alt)+'" loading="lazy"></figure>';
      return '<figure class="c-img'+sc+'"'+style+drop+(o.edit?'':' role="img" aria-label="'+esc(txt(b,k,D.img))+'"')+'>'+T(k, D.img)+'</figure>';
    };
    const hpx = Math.max(60, b.ch*46);

    switch(b.type){
      case 'group': return P('<section class="c-group">')+'\n'+rowsHTML(b.rows||[], pad+'  ', o)+'\n'+P('</section>');
      case 'nav': {
        const links = env.links ? env.links() : null, pn = pageNames();
        let ln;
        if(pn.length > 1) ln = pn.slice(0,4).map((nm,j) => '<a href="'+(links&&links[j]?esc(links[j].href):'#')+'">'+T('navP'+j, nm)+'</a>').join('');
        else ln = '<a href="#">'+T('navA',D.navA)+'</a><a href="#">'+T('navB',D.navB)+'</a><a href="#">'+T('navC',D.navC)+'</a>';
        return wrap('c-nav'+al, '<span class="lg">'+T('brand',D.brand)+'</span>\n<span class="ln">'+ln+'</span>\n'+
          '<a class="cta" href="#">'+T('navCta',D.navCta)+'</a>', ' aria-label="Main"');
      }
      case 'hero': { const h = heading('hero');
        return wrap('c-hero'+al, '<'+h+'>'+T('heroH',D.heroH)+'</'+h+'>\n<p>'+T('heroP',D.heroP)+'</p>\n'+
          '<div class="bs"><a class="b1" href="#">'+T('heroB1',D.heroB1)+'</a><a class="b2" href="#">'+T('heroB2',D.heroB2)+'</a></div>'); }
      case 'cards': return P('<section class="c-grid" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
        D.cards.slice(0,n).map((c,j) => pad+'  <article class="c-card'+sc+'"><div class="k">'+T('cardK'+j,c[0])+'</div><h3>'+
          T('cardH'+j,c[1])+'</h3><p>'+T('cardP'+j,c[2])+'</p></article>').join('\n')+'\n'+P('</section>');
      case 'text': { const h = heading('text');
        return wrap('c-text'+al, '<'+h+'>'+T('textH',D.textH)+'</'+h+'>\n<p>'+T('textP',D.textP)+'</p>'); }
      case 'image': return P(img('img', hpx));
      case 'gallery': return P('<section class="c-gal" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
        Array.from({length:n}, (_,j) => pad+'  '+img('gal'+j, Math.round(Math.max(70, hpx/1.6)))).join('\n')+'\n'+P('</section>');
      case 'sidebar': return wrap('c-side'+al, D.side.map((s,j) => '<a class="it'+(j===0?' a':'')+'" href="#">'+T('side'+j,s)+'</a>').join('\n'), ' aria-label="Section"');
      case 'stats': return P('<section class="c-stats" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">')+'\n'+
        D.stats.slice(0,n).map((s,j) => pad+'  <div class="s"><div class="n">'+T('statN'+j,s[0])+'</div><div class="l">'+T('statL'+j,s[1])+'</div></div>').join('\n')+'\n'+P('</section>');
      case 'logos': return P('<section class="c-logos'+al+'" aria-label="Logos">')+'\n'+
        D.logos.slice(0,Math.max(n,4)).map((l,j) => pad+'  <span class="lo">'+T('logo'+j,l)+'</span>').join('\n')+'\n'+P('</section>');
      case 'quote': return wrap('c-quote'+al, '<blockquote>'+T('quote',D.quote)+'</blockquote>\n<figcaption class="who">'+T('who',D.who)+'</figcaption>');
      case 'form': {
        const names = ['name','email','message'], types = ['text','email'];
        const fld = j => o.edit
          ? '<label class="inp"'+(j===2?' style="height:70px"':'')+'>'+T('form'+j,D.form[j])+'</label>'
          : '<label class="inp"'+(j===2?' style="height:70px"':'')+'><span class="vh">'+plain('form'+j,D.form[j])+'</span>'+
            (j===2 ? '<textarea name="message" placeholder="'+plain('form2',D.form[2])+'"></textarea>'
                   : '<input type="'+types[j]+'" name="'+names[j]+'" placeholder="'+plain('form'+j,D.form[j])+'" autocomplete="'+(j===0?'name':'email')+'">')+'</label>';
        return wrap('c-form'+al, [0,1,2].map(fld).join('\n')+'\n<button class="sb" type="'+(o.edit?'button':'submit')+'">'+T('form3',D.form[3])+'</button>');
      }
      case 'table': return P('<div class="c-table"><table>')+'\n'+pad+'  <thead><tr>'+
        D.th.map((h,j) => '<th scope="col">'+T('th'+j,h)+'</th>').join('')+'</tr></thead>\n'+pad+'  <tbody>'+
        D.rows.map((r,ri) => '<tr>'+r.map((c,ci) => '<td>'+T('td'+ri+'_'+ci,c)+'</td>').join('')+'</tr>').join('')+'</tbody>\n'+P('</table></div>');
      case 'tabs': return wrap('c-tabs'+al, '<div class="tl" role="tablist">'+D.tabs.map((x,j) => '<span class="tb'+(j===0?' a':'')+'" role="tab" aria-selected="'+(j===0)+'">'+
        T('tab'+j,x)+'</span>').join('')+'</div>\n<p role="tabpanel">'+T('tabsP',D.tabsP)+'</p>');
      case 'price': return P('<section class="c-price" style="grid-template-columns:repeat('+Math.min(n,3)+',minmax(0,1fr))">')+'\n'+
        D.price.slice(0,Math.min(n,3)).map((p,j) => pad+'  <div class="p'+sc+'"><div class="tn">'+T('priceN'+j,p[0])+'</div><div class="am">'+
          T('priceA'+j,p[1])+'</div><ul><li>'+T('priceF'+j,p[2])+'</li></ul></div>').join('\n')+'\n'+P('</section>');
      case 'banner': { const h = heading('banner');
        return wrap('c-banner'+al, '<'+h+'>'+T('banner',D.banner)+'</'+h+'>\n<a class="b" href="#">'+T('bannerB',D.bannerB)+'</a>'); }
      case 'code': {
        const v = txt(b,'code',D.code);
        return P('<div class="c-code"><pre><code'+(o.edit?' class="ed" contenteditable="true" spellcheck="false" data-b="'+b._i+'" data-k="code"':'')+'>'+esc(v)+'</code></pre></div>');
      }
      case 'button': {
        const v = b.variant || 'primary';
        if(v==='group') return P('<div class="c-btn'+al+'"><div class="bgroup"><button class="bt bt-primary" type="button">'+T('btn',D.btn)+
          '</button><button class="bt bt-secondary" type="button">'+T('btnB',D.btnB)+'</button><button class="bt bt-ghost" type="button">'+T('btnC',D.btnC)+'</button></div></div>');
        return P('<div class="c-btn'+al+'"><button class="bt bt-'+v+'" type="button">'+T('btn',D.btn)+'</button></div>');
      }
      case 'footer': return wrap('c-foot'+al, '<span>'+T('footL',D.footL)+'</span>\n<span class="sp">'+T('footR',D.footR)+'</span>');
    }
    const def = custom(b.type);
    if(def){
      const html = String(def.template||'').replace(FIELD_RE, (m,k,v) => T(k, (v||'').trim()));
      return html.split('\n').map(l => pad+l).join('\n');
    }
    return P('<div></div>');
  }

  const mk = (b, pad, o) => addCls(mkInner(b, pad||'', o||{}), rspClass(b));

  function rowsHTML(R, pad, o){
    o = o || {};
    return R.map(row => {
      if(row.items.length===1) return mk(row.items[0], pad, o);
      const cols = row.items.map(b => b.cw+'fr').join(' ');
      return pad+'<section class="c-row'+rowClass(row.items)+'" style="--cols:'+cols+';grid-template-columns:'+cols+'">\n'+
        row.items.map(b => mk(b, pad+'  ', o)).join('\n')+'\n'+pad+'</section>';
    }).join('\n\n');
  }

  const hasType = (R, t) => R.some(r => r.items.some(b => b.type===t || (b.rows && hasType(b.rows, t))));
  /* body of one page; opts.edit for the live preview */
  function body(arr, opts){
    const R = laidRows(arr);
    if(!R.length) return '';
    const o = {edit: !!(opts && opts.edit), st: {promote: !hasType(R, 'hero')}};
    return rowsHTML(R, (opts && opts.pad!=null) ? opts.pad : '  ', o);
  }

  /* ---------------- React: components from @mirage/ui, text as props */
  function react(arr){
    const R = laidRows(arr); if(!R.length) return '// nothing drawn yet';
    const used = new Set(), ctx = {pageNames: pageNames(), custom};
    const props = b => {
      const bits = [];
      if(b.align && b.align!=='start') bits.push('align="'+b.align+'"');
      if(b.shape && b.shape!=='rect') bits.push('shape="'+b.shape+'"');
      if(b.type==='button') bits.push('variant="'+(b.variant||'primary')+'"');
      if(MULTI.indexOf(b.type)>=0) bits.push('columns={'+clamp(b.cells||3,2,6)+'}');
      if(b.hide && b.hide.length) bits.push('hideOn={'+JSON.stringify(b.hide.map(h => h==='t'?'tablet':'phone'))+'}');
      if(b.first) bits.push('firstOnPhone');
      const t = {};
      fieldsFor(b, ctx).forEach(([k,def]) => { const v = txt(b,k,def); if(v!==def || /^navP/.test(k)) t[k] = v; });
      if(b.c) Object.keys(b.c).filter(k => /:(src|alt)$/.test(k)).forEach(k => { t[k] = /:src$/.test(k) ? asset(b.c[k]) : b.c[k]; });
      if(Object.keys(t).length) bits.push('t={'+JSON.stringify(t)+'}');
      return bits.length ? ' '+bits.join(' ') : '';
    };
    const one = (b, pad) => {
      if(b.type==='group'){ used.add('Group'); return pad+'<Group>\n'+rowsJSX(b.rows||[], pad+'  ')+'\n'+pad+'</Group>'; }
      if(!RMAP[b.type]){   // custom component: its own exported HTML
        used.add('Raw');
        return pad+'<Raw html={'+JSON.stringify(mk(b,'',{st:{h1:true}}))+'} />';
      }
      used.add(RMAP[b.type]);
      return pad+'<'+RMAP[b.type]+props(b)+' />';
    };
    const rowsJSX = (rows, pad) => rows.map(row => row.items.length===1 ? one(row.items[0], pad)
      : (used.add('Row'), pad+'<Row cols={['+row.items.map(b => b.cw).join(',')+']}'+
        (row.items[0].stack ? ' stack="'+(row.items[0].stack==='t'?'tablet':'never')+'"' : '')+'>\n'+
        row.items.map(b => one(b, pad+'  ')).join('\n')+'\n'+pad+'</Row>')).join('\n');
    const bodyJSX = rowsJSX(R, '      ');
    return "// generated by Mirage\n// Components: the mirage-ui.jsx file in the download, or `npm i @mirage/ui`\n"+
      "import { "+[...used].join(', ')+" } from './mirage-ui'\nimport './mirage.css'\n\n"+
      "export default function Page() {\n  return (\n    <main className=\"page\">\n"+bodyJSX+"\n    </main>\n  )\n}\n";
  }

  /* ---------------- Tailwind */
  function tailwind(arr){
    const R = laidRows(arr); if(!R.length) return '<!-- nothing drawn yet -->';
    const SH = {round:'rounded-lg', pill:'rounded-full', circle:'rounded-full aspect-square', squircle:'rounded-3xl', cut:''};
    const AL = {start:'', center:'text-center items-center justify-center', end:'text-right items-end justify-end'};
    const BT = {primary:'bg-neutral-900 text-white px-5 py-2.5', secondary:'border-2 border-neutral-900 px-5 py-2.5',
      ghost:'px-5 py-2.5 hover:bg-neutral-100', pill:'bg-neutral-900 text-white px-6 py-2.5 rounded-full',
      link:'underline underline-offset-4', group:'flex gap-2'};
    const base = {nav:'flex items-center gap-5 px-6 py-3.5 border-b border-neutral-200', hero:'px-6 py-14',
      cards:'grid gap-3 p-6', text:'p-6 max-w-prose', image:'bg-neutral-100 min-h-[180px] grid place-items-center overflow-hidden',
      gallery:'grid gap-2 p-6', sidebar:'p-6 space-y-1', stats:'grid gap-px bg-neutral-200 p-6',
      logos:'flex flex-wrap items-center justify-between gap-3 p-6 opacity-70', quote:'px-6 py-10',
      form:'p-6 grid gap-2 max-w-md', table:'p-6 overflow-x-auto', tabs:'p-6', price:'grid gap-3 p-6',
      banner:'px-6 py-12 bg-neutral-900 text-white', code:'m-6 p-4 bg-neutral-900 text-neutral-100 text-xs',
      button:'p-6 flex', footer:'p-6 border-t border-neutral-200 text-sm text-neutral-500'};
    const one = (b, pad) => {
      const n = clamp(b.cells||3, 2, 6);
      let cls = base[b.type] || 'p-6';
      if(['cards','gallery','stats','price'].indexOf(b.type)>=0) cls += ' grid-cols-1 md:grid-cols-'+n;
      if(SHAPED.indexOf(b.type)>=0 && b.shape && SH[b.shape]) cls += ' '+SH[b.shape];
      if(b.align && AL[b.align]) cls += ' '+AL[b.align];
      if(b.hide && b.hide.indexOf('t')>=0) cls += ' max-md:hidden';
      else if(b.hide && b.hide.indexOf('p')>=0) cls += ' max-sm:hidden';
      if(b.first) cls += ' max-md:order-first';
      if(b.type==='group') return pad+'<section class="p-6">\n'+rowsTW(b.rows||[], pad+'  ')+'\n'+pad+'</section>';
      if(b.type==='button') return pad+'<div class="'+cls+'"><button type="button" class="'+BT[b.variant||'primary']+'">'+esc(txt(b,'btn',D.btn))+'</button></div>';
      if(b.type==='image' && b.c && b.c['img:src'])
        return pad+'<figure class="'+cls+'"><img class="w-full h-full object-cover" src="'+esc(asset(b.c['img:src']))+'" alt="'+esc(b.c['img:alt']||'')+'"></figure>';
      if(custom(b.type)) return mk(b, pad, {st:{h1:true}});
      const t = TAG[b.type] || 'section';
      return pad+'<'+t+' class="'+cls+'">'+esc(NICE[b.type]||b.type)+'</'+t+'>';
    };
    const rowsTW = (rows, pad) => rows.map(row => {
      if(row.items.length===1) return one(row.items[0], pad);
      const fr = row.items.map(b => b.cw+'fr').join('_'), st = row.items[0].stack;
      const g = st==='keep' ? 'grid grid-cols-['+fr+']' : (st==='t' ? 'grid grid-cols-1 lg:grid-cols-['+fr+']' : 'grid grid-cols-1 md:grid-cols-['+fr+']');
      return pad+'<section class="'+g+'">\n'+row.items.map(b => one(b, pad+'  ')).join('\n')+'\n'+pad+'</section>';
    }).join('\n\n');
    return '<!-- generated by Mirage · Tailwind -->\n<main>\n'+rowsTW(R, '  ')+'\n</main>';
  }

  return {laidRows, mk, rowsHTML, body, react, tailwind};
}
