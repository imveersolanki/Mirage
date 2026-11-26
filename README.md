# Mirage

An open source frontend builder. Draw a wireframe, get a component.

Mirage reads the geometry of a sketch the way a person does — where a box
sits, how tall it is for its width, and what sits beside it — then builds
the page that geometry implies and hands you the code.

## Structure

```
/
├── index.html              landing page               → /
├── mirage/index.html       the editor                 → /mirage
├── gallery/                example sketches           → /gallery
├── js/
│   ├── core/               pure modules, browser and Node
│   │   ├── content.js        component list and default text
│   │   ├── classify.js       the classifier
│   │   ├── markup.js         one generator for preview, HTML, React, Tailwind
│   │   ├── css.js · jsx.js · site.js   stylesheet, JSX and page head for the CLI
│   ├── mirage.js           the editor engine (ES module)
│   ├── mirage-tools.js     palette, snippets, versions, share links, exports, deploy, Figma SVG
│   ├── mirage-import.js    photo of a sketch or a screenshot → boxes
│   ├── mirage-ai.js        Gemini: copy, palette, layout, handwriting
│   ├── mirage-live.js      peer to peer sessions, per-box merge
│   ├── mirage-media.js     images and alt text
│   ├── mirage-quality.js   accessibility and SEO checks, page titles
│   └── mirage-components.js  your own components
├── css/                    landing, editor chrome + output, 35 styles
├── packages/ui/            @mirage/ui, the React components the export imports
├── cli/mirage.mjs          npx mirage build | check | css
├── figma-plugin/           Figma ↔ Mirage
├── tests/                  unit tests (node --test) and Playwright e2e
├── media/                  demo video and clips
└── docs/launch.md          Product Hunt, Show HN, social copy
```

The feature modules talk to the engine only through `window.Mirage`, so any
of them can be removed without breaking the editor.

## CLI

Commit the sketch (Export → JSON) and build it anywhere:

```bash
npx github:Veer1778/Mirage build sketch.json --target site --out dist
npx github:Veer1778/Mirage build sketch.json --target next --out app
npx github:Veer1778/Mirage check sketch.json        # exits 1 on errors, e.g. images without alt text
```

Targets: `site`, `html`, `react`, `next`, `tailwind`, `json`. The CLI uses the
same core modules as the editor, so the output is the same.

## Tests

```bash
npm install
npm test            # classifier, markup, CLI, @mirage/ui, Figma plugin
npm run test:e2e    # the editor in Chromium via Playwright
```

CI runs both on every push (`.github/workflows/ci.yml`).

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
Or `npm run dev` for the bundled server on port 4173.

## Deploy

```
vercel
```

Framework preset **Other**, no build command. `cleanUrls` in `vercel.json`
maps `mirage/index.html` to `/mirage`.

## Licence

MIT
