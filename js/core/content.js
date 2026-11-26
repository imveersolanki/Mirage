/* Mirage core: constants and default content. Pure data, runs in the browser and in Node. */
export const COLS = 16, MINROWS = 26;
export const TYPES = [
  ['nav','Nav bar'],['hero','Hero'],['cards','Card grid'],['text','Text block'],
  ['image','Image'],['gallery','Gallery'],['sidebar','Side nav'],['stats','Stat row'],
  ['logos','Logo row'],['quote','Quote'],['form','Form'],['table','Table'],
  ['tabs','Tabs'],['price','Pricing'],['banner','CTA banner'],['code','Code block'],
  ['button','Button'],['footer','Footer'],
];

export const MULTI=['cards','stats','logos','gallery','price'];
export const SHAPED=['cards','image','gallery','price'];
export const ALIGNABLE=['hero','text','button','banner','quote','footer','nav','sidebar','logos','form','tabs'];
export const SHAPES=[['rect','Square'],['round','Rounded'],['pill','Pill'],
  ['circle','Circle'],['squircle','Squircle'],['cut','Cut corner']];
export const VARIANTS=[['primary','Primary'],['secondary','Secondary'],['ghost','Ghost'],
  ['pill','Pill'],['link','Link'],['group','Group']];
export const ALIGNS=[['start','Left'],['center','Centre'],['end','Right']];

export const FONTS=['Inter','Archivo','Archivo Black','Space Grotesk','Manrope','Sora','Syne','Work Sans',
  'DM Sans','IBM Plex Sans','Roboto','Oswald','Bebas Neue','Nunito','Playfair Display',
  'Cormorant Garamond','EB Garamond','Libre Baskerville','Lora','Source Serif 4','Fraunces',
  'Instrument Serif','Poiret One','Caveat','Kalam','JetBrains Mono','IBM Plex Mono','Space Mono',
  'VT323','Orbitron'];

export const DEFAULT_DESIGN = {
  bg:'#FFFFFF', fg:'#111111', mut:'#6E6E6E', line:'#E4E4E4', acc:'#E30613', acc2:'#111111',
  fontD:'Inter', fontB:'Inter', weight:800, track:-30,
  radius:2, border:1, pad:26, shadow:'none',
};

export const NICE = Object.assign(Object.fromEntries(TYPES), {group:'Group'});

/* default text for every component */
export const D = {
  brand:'Mirage', navA:'Docs', navB:'Components', navC:'Roadmap', navCta:'Get started',
  heroH:'Everything you draw becomes real',
  heroP:'Mirage reads the geometry of a wireframe the way a person does, then builds the page it implies.',
  heroB1:'Start drawing', heroB2:'Read the docs',
  textH:'How the classifier reads a box',
  textP:'A box near the top edge that spans the full width is a nav bar. The same box halfway down the page, given more height, is a hero. Width relative to the page and height relative to width carry almost all the meaning in a wireframe.',
  cards:[['Position','Where it sits','Vertical position separates a nav from a footer.'],
    ['Proportion','How tall for its width','A tall narrow box is a rail, a wide short one a bar.'],
    ['Company','What sits beside it','Boxes sharing a row are built side by side.'],
    ['Span','How wide it runs','Width snaps to the column grid.'],
    ['Order','What comes before','Reading order follows the vertical axis.'],
    ['Override','What you corrected','A box you set by hand is never re-read.']],
  stats:[['18','components'],['16','columns'],['0','dependencies'],['MIT','licence'],['7','targets'],['90','undo steps']],
  logos:['Northwind','Cassini','Half Measure','Bellwether','Ordinal','Meridian'],
  side:['Overview','Reading a box','The column grid','Overrides','Export'],
  quote:'I drew the page on a napkin, photographed the napkin, and had the layout before the coffee arrived.',
  who:'\u2014 an optimistic description of the roadmap',
  tabs:['Geometry','Overrides','Export'],
  tabsP:'Every rule is a threshold you can tune, and every box you set by hand is left alone.',
  th:['Component','Signal','Shape','Conf.'],
  rows:[['Nav bar','first row','full width','0.95'],['Hero','top rows','tall, full','0.88'],
    ['Card grid','shared row','uniform','0.86']],
  form:['Name','Email address','Message','Send'],
  price:[['Free','$0','Everything, it is open source'],['Also free','$0','There is no second tier'],
    ['Still free','$0','Self host it anywhere']],
  banner:'Draw the page. Ship the page.', bannerB:'Open the editor',
  btn:'Start drawing', btnB:'Read the docs', btnC:'Learn more',
  footL:'Mirage', footR:'Drawn, not configured',
  img:'IMAGE',
  code:'<section class="c-row">\n  <header class="c-hero">…</header>\n  <figure class="c-img">…</figure>\n</section>',
};

/* every text field a component shows, with its default; used by AI copy, React props and the CLI */
export function fieldsFor(b, ctx){
  const n = Math.max(2, Math.min(6, b.cells||3)), f = [];
  const add = (k, v) => f.push([k, v]);
  switch(b.type){
    case 'nav': add('brand', D.brand);
      if(ctx && ctx.pageNames && ctx.pageNames.length > 1) ctx.pageNames.slice(0,4).forEach((nm,j) => add('navP'+j, nm));
      else { add('navA', D.navA); add('navB', D.navB); add('navC', D.navC); }
      add('navCta', D.navCta); break;
    case 'hero': add('heroH', D.heroH); add('heroP', D.heroP); add('heroB1', D.heroB1); add('heroB2', D.heroB2); break;
    case 'cards': D.cards.slice(0,n).forEach((c,j) => { add('cardK'+j, c[0]); add('cardH'+j, c[1]); add('cardP'+j, c[2]); }); break;
    case 'text': add('textH', D.textH); add('textP', D.textP); break;
    case 'image': add('img', D.img); break;
    case 'gallery': for(let j=0;j<n;j++) add('gal'+j, D.img); break;
    case 'sidebar': D.side.forEach((t,j) => add('side'+j, t)); break;
    case 'stats': D.stats.slice(0,n).forEach((s,j) => { add('statN'+j, s[0]); add('statL'+j, s[1]); }); break;
    case 'logos': D.logos.slice(0,Math.max(n,4)).forEach((l,j) => add('logo'+j, l)); break;
    case 'quote': add('quote', D.quote); add('who', D.who); break;
    case 'form': D.form.forEach((v,j) => add('form'+j, v)); break;
    case 'table': D.th.forEach((h,j) => add('th'+j, h)); D.rows.forEach((r,ri) => r.forEach((c,ci) => add('td'+ri+'_'+ci, c))); break;
    case 'tabs': D.tabs.forEach((t,j) => add('tab'+j, t)); add('tabsP', D.tabsP); break;
    case 'price': D.price.slice(0,Math.min(n,3)).forEach((p,j) => { add('priceN'+j, p[0]); add('priceA'+j, p[1]); add('priceF'+j, p[2]); }); break;
    case 'banner': add('banner', D.banner); add('bannerB', D.bannerB); break;
    case 'code': add('code', D.code); break;
    case 'button': add('btn', D.btn); if(b.variant==='group'){ add('btnB', D.btnB); add('btnC', D.btnC); } break;
    case 'footer': add('footL', D.footL); add('footR', D.footR); break;
    default:
      if(ctx && ctx.custom){ const def = ctx.custom(b.type); if(def) templateFields(def.template).forEach(([k,v]) => add(k, v)); }
  }
  return f;
}

/* custom component templates use {{key|default text}} */
export const FIELD_RE = /\{\{\s*([a-zA-Z][\w]*)\s*(?:\|([^}]*))?\}\}/g;
export function templateFields(tpl){
  const out = [], seen = new Set();
  String(tpl||'').replace(FIELD_RE, (m,k,v) => { if(!seen.has(k)){ seen.add(k); out.push([k, (v||'').trim()]); } return m; });
  return out;
}
