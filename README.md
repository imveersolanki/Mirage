# Mirage

An open source frontend builder. Draw a wireframe, get a component.

Mirage reads the geometry of a sketch the way a person does — where a box
sits, how tall it is for its width, and what sits beside it — then builds
the page that geometry implies and hands you the code.

## Structure

```
/
├── index.html            landing page        → /
├── mirage/
│   └── index.html        the editor          → /mirage
├── css/
│   ├── landing.css
│   ├── mirage.css        editor chrome + responsive output rules
│   └── themes.css        design styles (35 with the house set)
├── js/
│   ├── landing.js
│   ├── mirage.js         the engine: grid, classifier, render, export, pages
│   ├── mirage-tools.js   palette, snippets, versions, share links, exports, deploy, Figma
│   ├── mirage-import.js  photo of a sketch or a screenshot → boxes
│   ├── mirage-ai.js      Gemini: copy, palette, layout (bring your own key)
│   └── mirage-live.js    live sessions with named cursors
└── vercel.json
```

The feature modules only talk to the engine through `window.Mirage`, so any
of them can be removed without breaking the editor.

## Features

- **Read, then override.** Every box shows what else it could be ("also reads
  as Image 68%"); one click switches it and it stays set.
- **Nesting.** Alt-drag inside a box to draw a child. The parent becomes a
  group and its children are laid out as rows inside it.
- **Small screens.** Hide a box on tablet or phone, move it first on phone,
  and choose when a row stacks. Exported as real media queries.
- **Pages.** Several pages per project with shared nav and footer text. Nav
  links become real links in the site export.
- **Import.** A photo of a paper wireframe or a screenshot of any site turns
  into boxes, entirely in the browser.
- **AI.** Write the copy, design a palette, or draft a layout from a one-line
  brief, with your own Gemini key.
- **Export.** HTML, React, Tailwind, Vue, Svelte, Astro, Next.js (whole app
  folder), design.md, JSON, or every page as a static site zip.
- **Share.** The whole sketch packed into a link, Figma SVG out and back in,
  and one-click deploy to Netlify with a personal token.
- **Live.** Peer to peer sessions with named cursors. Tabs on one device
  sync instantly; other devices connect over WebRTC via PeerJS.
- **Workflow.** Command palette (⌘K), snippets, named versions.

No build step, no dependencies, no server. Every page is plain
HTML/CSS/JS served as static files.

## How the model works

The sketch is stored as integer grid cells, not pixels:

```js
{ cx: 0, cy: 2, cw: 7, ch: 6 }   // column, row, width, height
```

Cells are square, so a box's aspect ratio is literally `ch / cw`. That one
decision gives square grid rendering, vertical snapping, collision
detection and side-by-side layout the same arithmetic.

**Rows.** Boxes whose vertical spans overlap belong to the same row and are
rendered as a horizontal band with `grid-template-columns` derived from
their widths. This is why an image drawn beside a hero appears beside it
rather than under it.

**Collision.** Boxes can never overlap. A blocked move is retried on each
axis separately, so dragging slides along an obstacle instead of stopping.

**Overrides.** Any box you set by hand is never re-read by the classifier.
Low-confidence reads are flagged rather than guessed silently.

## Styles

35 total: 5 house themes (Plain, Editorial, Brutal, Soft, Terminal) plus the 30 catalogued at
[designprompts.dev](https://designprompts.dev). Each is a set of design
tokens on `#sheet`, so switching one never touches your structure.

## Run locally

```
npx serve .
```

Then open `http://localhost:3000` and `http://localhost:3000/mirage`.

## Deploy

```
vercel
```

Framework preset **Other**, no build command. `cleanUrls` in `vercel.json`
maps `mirage/index.html` to `/mirage`.

## Licence

MIT
