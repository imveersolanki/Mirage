/* @mirage/ui: the React components Mirage's React export uses.
   Same markup and class names as the HTML export, so mirage.css styles both.
   Every text prop has a default; pass only what you changed through `t`. */
import React from 'react';

export const DEFAULTS = {
  "brand": "Mirage",
  "navA": "Docs",
  "navB": "Components",
  "navC": "Roadmap",
  "navCta": "Get started",
  "heroH": "Everything you draw becomes real",
  "heroP": "Mirage reads the geometry of a wireframe the way a person does, then builds the page it implies.",
  "heroB1": "Start drawing",
  "heroB2": "Read the docs",
  "textH": "How the classifier reads a box",
  "textP": "A box near the top edge that spans the full width is a nav bar. The same box halfway down the page, given more height, is a hero. Width relative to the page and height relative to width carry almost all the meaning in a wireframe.",
  "cards": [
    [
      "Position",
      "Where it sits",
      "Vertical position separates a nav from a footer."
    ],
    [
      "Proportion",
      "How tall for its width",
      "A tall narrow box is a rail, a wide short one a bar."
    ],
    [
      "Company",
      "What sits beside it",
      "Boxes sharing a row are built side by side."
    ],
    [
      "Span",
      "How wide it runs",
      "Width snaps to the column grid."
    ],
    [
      "Order",
      "What comes before",
      "Reading order follows the vertical axis."
    ],
    [
      "Override",
      "What you corrected",
      "A box you set by hand is never re-read."
    ]
  ],
  "stats": [
    [
      "18",
      "components"
    ],
    [
      "16",
      "columns"
    ],
    [
      "0",
      "dependencies"
    ],
    [
      "MIT",
      "licence"
    ],
    [
      "7",
      "targets"
    ],
    [
      "90",
      "undo steps"
    ]
  ],
  "logos": [
    "Northwind",
    "Cassini",
    "Half Measure",
    "Bellwether",
    "Ordinal",
    "Meridian"
  ],
  "side": [
    "Overview",
    "Reading a box",
    "The column grid",
    "Overrides",
    "Export"
  ],
  "quote": "I drew the page on a napkin, photographed the napkin, and had the layout before the coffee arrived.",
  "who": "— an optimistic description of the roadmap",
  "tabs": [
    "Geometry",
    "Overrides",
    "Export"
  ],
  "tabsP": "Every rule is a threshold you can tune, and every box you set by hand is left alone.",
  "th": [
    "Component",
    "Signal",
    "Shape",
    "Conf."
  ],
  "rows": [
    [
      "Nav bar",
      "first row",
      "full width",
      "0.95"
    ],
    [
      "Hero",
      "top rows",
      "tall, full",
      "0.88"
    ],
    [
      "Card grid",
      "shared row",
      "uniform",
      "0.86"
    ]
  ],
  "form": [
    "Name",
    "Email address",
    "Message",
    "Send"
  ],
  "price": [
    [
      "Free",
      "$0",
      "Everything, it is open source"
    ],
    [
      "Also free",
      "$0",
      "There is no second tier"
    ],
    [
      "Still free",
      "$0",
      "Self host it anywhere"
    ]
  ],
  "banner": "Draw the page. Ship the page.",
  "bannerB": "Open the editor",
  "btn": "Start drawing",
  "btnB": "Read the docs",
  "btnC": "Learn more",
  "footL": "Mirage",
  "footR": "Drawn, not configured",
  "img": "IMAGE",
  "code": "<section class=\"c-row\">\n  <header class=\"c-hero\">…</header>\n  <figure class=\"c-img\">…</figure>\n</section>"
};

const cx = (...a) => a.filter(Boolean).join(' ');
const rsp = p => cx(p.hideOn && p.hideOn.includes('tablet') && 'c-hide-t', p.hideOn && p.hideOn.includes('phone') && 'c-hide-p', p.firstOnPhone && 'c-first');
const al = p => (p.align && p.align !== 'start' ? 'al-' + p.align : '');
const sh = p => (p.shape && p.shape !== 'rect' ? 'sh-' + p.shape : '');
const cols = n => ({ gridTemplateColumns: `repeat(${n},minmax(0,1fr))` });
const T = (p, k, fb) => (p.t && p.t[k] != null && p.t[k] !== '' ? p.t[k] : fb);
const N = (p, max = 6) => Math.max(2, Math.min(max, p.columns || 3));
const D = DEFAULTS;

/* a row of components side by side; collapses on small screens unless stack="never" */
export function Row({ cols: c = [1, 1], stack, children }) {
  const t = c.map(x => x + 'fr').join(' ');
  return <section className={cx('c-row', stack === 'tablet' && 'c-stack-t', stack === 'never' && 'c-keep')} style={{ '--cols': t, gridTemplateColumns: t }}>{children}</section>;
}
export function Group({ children }) { return <section className="c-group">{children}</section>; }

export function Nav(p) {
  const links = p.links || [T(p, 'navA', D.navA), T(p, 'navB', D.navB), T(p, 'navC', D.navC)].map(l => ({ label: l, href: '#' }));
  return (
    <nav className={cx('c-nav', al(p), rsp(p))} aria-label="Main">
      <span className="lg">{T(p, 'brand', D.brand)}</span>
      <span className="ln">{links.map((l, i) => <a key={i} href={l.href}>{l.label}</a>)}</span>
      <a className="cta" href={p.ctaHref || '#'}>{T(p, 'navCta', D.navCta)}</a>
    </nav>
  );
}
export function Hero(p) {
  const H = p.level === 2 ? 'h2' : 'h1';
  return (
    <header className={cx('c-hero', al(p), rsp(p))}>
      <H>{T(p, 'heroH', D.heroH)}</H>
      <p>{T(p, 'heroP', D.heroP)}</p>
      <div className="bs"><a className="b1" href="#">{T(p, 'heroB1', D.heroB1)}</a><a className="b2" href="#">{T(p, 'heroB2', D.heroB2)}</a></div>
    </header>
  );
}
export function CardGrid(p) {
  const n = N(p);
  return (
    <section className={cx('c-grid', rsp(p))} style={cols(n)}>
      {D.cards.slice(0, n).map((c, j) => (
        <article key={j} className={cx('c-card', sh(p))}>
          <div className="k">{T(p, 'cardK' + j, c[0])}</div><h3>{T(p, 'cardH' + j, c[1])}</h3><p>{T(p, 'cardP' + j, c[2])}</p>
        </article>))}
    </section>
  );
}
export function Prose(p) {
  const H = p.level === 1 ? 'h1' : 'h2';
  return <section className={cx('c-text', al(p), rsp(p))}><H>{T(p, 'textH', D.textH)}</H><p>{T(p, 'textP', D.textP)}</p></section>;
}
function Img({ p, k, minHeight }) {
  const src = p.t && p.t[k + ':src'], alt = (p.t && p.t[k + ':alt']) || '';
  if (src) return <figure className={cx('c-img has-img', sh(p))} style={{ minHeight }}><img src={src} alt={alt} loading="lazy" /></figure>;
  return <figure className={cx('c-img', sh(p))} style={{ minHeight }} role="img" aria-label={T(p, k, D.img)}>{T(p, k, D.img)}</figure>;
}
export function Figure(p) { return <div className={rsp(p) || undefined} style={{ display: 'contents' }}><Img p={p} k="img" minHeight={p.minHeight || 230} /></div>; }
export function Gallery(p) {
  const n = N(p);
  return <section className={cx('c-gal', rsp(p))} style={cols(n)}>{Array.from({ length: n }, (_, j) => <Img key={j} p={p} k={'gal' + j} minHeight={p.minHeight || 144} />)}</section>;
}
export function Rail(p) {
  return <aside className={cx('c-side', al(p), rsp(p))} aria-label="Section">{D.side.map((s, j) => <a key={j} className={cx('it', j === 0 && 'a')} href="#">{T(p, 'side' + j, s)}</a>)}</aside>;
}
export function Stats(p) {
  const n = N(p);
  return <section className={cx('c-stats', rsp(p))} style={cols(n)}>{D.stats.slice(0, n).map((s, j) => <div key={j} className="s"><div className="n">{T(p, 'statN' + j, s[0])}</div><div className="l">{T(p, 'statL' + j, s[1])}</div></div>)}</section>;
}
export function LogoRow(p) {
  const n = Math.max(N(p), 4);
  return <section className={cx('c-logos', al(p), rsp(p))} aria-label="Logos">{D.logos.slice(0, n).map((l, j) => <span key={j} className="lo">{T(p, 'logo' + j, l)}</span>)}</section>;
}
export function Quote(p) {
  return <figure className={cx('c-quote', al(p), rsp(p))}><blockquote>{T(p, 'quote', D.quote)}</blockquote><figcaption className="who">{T(p, 'who', D.who)}</figcaption></figure>;
}
export function Form(p) {
  const f = j => T(p, 'form' + j, D.form[j]);
  return (
    <form className={cx('c-form', al(p), rsp(p))} onSubmit={p.onSubmit} action={p.action}>
      <label className="inp"><span className="vh">{f(0)}</span><input type="text" name="name" placeholder={f(0)} autoComplete="name" /></label>
      <label className="inp"><span className="vh">{f(1)}</span><input type="email" name="email" placeholder={f(1)} autoComplete="email" /></label>
      <label className="inp" style={{ height: 70 }}><span className="vh">{f(2)}</span><textarea name="message" placeholder={f(2)} /></label>
      <button className="sb" type="submit">{f(3)}</button>
    </form>
  );
}
export function DataTable(p) {
  return (
    <div className={cx('c-table', rsp(p))}><table>
      <thead><tr>{D.th.map((h, j) => <th key={j} scope="col">{T(p, 'th' + j, h)}</th>)}</tr></thead>
      <tbody>{D.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{T(p, 'td' + ri + '_' + ci, c)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
export function Tabs(p) {
  const [on, setOn] = React.useState(0);
  return (
    <section className={cx('c-tabs', al(p), rsp(p))}>
      <div className="tl" role="tablist">{D.tabs.map((x, j) => <span key={j} className={cx('tb', j === on && 'a')} role="tab" tabIndex={0} aria-selected={j === on} onClick={() => setOn(j)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOn(j)}>{T(p, 'tab' + j, x)}</span>)}</div>
      <p role="tabpanel">{T(p, 'tabsP', D.tabsP)}</p>
    </section>
  );
}
export function Pricing(p) {
  const n = N(p, 3);
  return <section className={cx('c-price', rsp(p))} style={cols(n)}>{D.price.slice(0, n).map((x, j) => <div key={j} className={cx('p', sh(p))}><div className="tn">{T(p, 'priceN' + j, x[0])}</div><div className="am">{T(p, 'priceA' + j, x[1])}</div><ul><li>{T(p, 'priceF' + j, x[2])}</li></ul></div>)}</section>;
}
export function Banner(p) {
  return <section className={cx('c-banner', al(p), rsp(p))}><h2>{T(p, 'banner', D.banner)}</h2><a className="b" href={p.href || '#'}>{T(p, 'bannerB', D.bannerB)}</a></section>;
}
export function CodeBlock(p) { return <div className={cx('c-code', rsp(p))}><pre><code>{T(p, 'code', D.code)}</code></pre></div>; }
export function Button(p) {
  const v = p.variant || 'primary';
  if (v === 'group') return <div className={cx('c-btn', al(p), rsp(p))}><div className="bgroup"><button className="bt bt-primary" type="button">{T(p, 'btn', D.btn)}</button><button className="bt bt-secondary" type="button">{T(p, 'btnB', D.btnB)}</button><button className="bt bt-ghost" type="button">{T(p, 'btnC', D.btnC)}</button></div></div>;
  return <div className={cx('c-btn', al(p), rsp(p))}><button className={'bt bt-' + v} type="button" onClick={p.onClick}>{T(p, 'btn', D.btn)}</button></div>;
}
export function Footer(p) { return <footer className={cx('c-foot', al(p), rsp(p))}><span>{T(p, 'footL', D.footL)}</span><span className="sp">{T(p, 'footR', D.footR)}</span></footer>; }
/* custom components arrive as exported HTML */
export function Raw({ html }) { return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />; }
