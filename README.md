```
 ███▄ ▄███  ██  ██████    ▄████▄    ▄████  ██████
 ██ ███ ██  ██  ██   ██  ██    ██  ██      ██
 ██  █  ██  ██  ██████   ████████  ██ ▄███ █████
 ██     ██  ██  ██  ██   ██    ██  ██  ██  ██
 ██     ██  ██  ██   ██  ██    ██   ██████ ██████
 ───────────────────────────────────────────────────
   ░▒▓█  DRAW A BOX. GET A COMPONENT.  █▓▒░
 ───────────────────────────────────────────────────
```

[MIRAGEUI.VERCEL.APP](https://mirageui.vercel.app)

Mirage is an open source frontend builder that reads a wireframe the way a person does. Where a box sits, how tall it is for its width, and what sits beside it decide what it becomes. No prompt, no account, no build step. Draw boxes, or photograph a sketch on paper, and get a real page with the code.

![License](https://img.shields.io/badge/license-MIT-green)
![Styles](https://img.shields.io/badge/styles-100-blue)
![Components](https://img.shields.io/badge/components-18%20%2B%20yours-blue)
![Tests](https://img.shields.io/badge/tests-97%20unit%20%2B%207%20e2e-brightgreen)
![Build](https://img.shields.io/badge/build%20step-none-lightgrey)
![Telemetry](https://img.shields.io/badge/telemetry-none-brightgreen)

## ✨ Features

- 🧠 **Reads geometry** — 18 components detected from position, proportion and neighbours. Unsure? It shows what else a box could be.
- 📸 **Photo import** — Photograph a paper sketch. Mirage straightens it, closes broken lines, finds nested boxes and reads your labels.
- 🖼 **Screenshot import** — Drop a screenshot of any site and get its structure as boxes.
- 🤖 **AI, your key** — Write the copy, design a palette or draft a layout from one line, with your own Gemini key.
- 👥 **Live** — Sketch together with named cursors. Edits merge box by box. Peer to peer, no Mirage server.
- 🎨 **100 styles** — From Swiss Minimalist to Tokyo Night to every look on designprompts.dev, plus your own design system as `design.md`.
- 🧩 **Your components** — A shape rule, an HTML template and CSS. Mirage reads and exports them like its own.
- 📄 **Pages** — Multi-page sites with shared nav and footer, real links, titles, descriptions and a sitemap.
- ♿ **Checks** — Contrast, alt text, one `h1` per page, labelled form fields, placeholder copy, SEO.
- 📦 **Seven targets** — HTML, React, Tailwind, Vue, Svelte, Astro, Next.js, or a whole static site.
- 🚀 **Deploy** — One click to Netlify with your token, or drag the zip onto Netlify Drop.
- ⌨️ **CLI** — Commit the sketch, build it in CI: `mirage build sketch.json --target next`.
- 🎛 **Figma plugin** — Frames to sketches and back. Layer names become types.
- 📱 **Touch** — Pinch to zoom, long-press to nest, one pane at a time on phones.

## 🚀 Quick Start

### Hosted

Open [mirageui.vercel.app/mirage](https://mirageui.vercel.app/mirage). Pick a starter or drag a box.

### Self-Host

Mirage is static files. No framework, no bundler, no server.

```bash
# Clone the repository
git clone https://github.com/imveersolanki/Mirage.git
cd Mirage

# Serve it (any static server works)
npm run dev                      # bundled server on :4173
# or
python3 -m http.server 8000
```

Open `/` for the landing page and `/mirage` for the editor.

### Deploy

Push to any static host. On Vercel use the **Other** preset with no build command; `vercel.json` maps `/mirage` to `mirage/index.html`.

## 🧠 How It Reads

Cells are square and every box is stored in grid cells, so a box's shape is literally `ch / cw`. Boxes whose vertical spans overlap share a row. Rules run in order; the first match wins and the rest become the "also reads as" suggestions.

| Signal | Reads as | Rule of thumb |
|--------|----------|---------------|
| 📍 First row, full width, short | **Nav bar** | `y` at the top, `w ≥ 78%`, `h ≤ 2` |
| 📍 Last row, full width, short | **Footer** | at the bottom of the last row |
| 📐 Tall, full width, near the top | **Hero** | `h ≥ 5` in the first two rows |
| 📐 Square-ish beside others | **Image** | `0.85 ≤ h/w ≤ 1.8`, at most half wide |
| 📐 Tall and narrow | **Side nav** | `w ≤ 30%`, `h/w > 1.3` |
| 🧱 Equal boxes in one row | **Card grid** | two to four, at most half wide each |
| 🧱 Four or more short equal boxes | **Logo row** | `h ≤ 2` |
| ✏️ Set by hand | **Whatever you picked** | never re-read |

Draw a box fully inside another (Alt-drag, or long-press on touch) and the outer one becomes a group with its own rows.

## 📸 Photo Import

All in the browser, nothing uploaded.

| Step | What it does |
|------|--------------|
| Threshold | Local-mean threshold finds pen strokes despite shadows |
| Straighten | Projection profile picks the angle where the ink lines up best |
| Bridge | Fills gaps along a line, but never at a corner, so stacked boxes stay apart |
| Fill | Flood fill from the edge marks the outside; enclosed regions are boxes |
| Shape test | A box's inside never touches the outside; writing inside is fine |
| X marks | An X through a box joins back into one Image |
| Labels | Optional: Gemini reads "hero", "nav", "img" written inside boxes |

## 📦 Export

| Target | You get |
|--------|---------|
| 🌐 HTML | One page, semantic markup, token-driven stylesheet |
| ⚛️ React | Page using `@mirage/ui`; the download includes the components |
| 🌊 Tailwind | Utilities with responsive rows |
| 💚 Vue | Single-file component |
| 🔥 Svelte | Component with global styles |
| 🚀 Astro | Page for `src/pages` |
| ▲ Next.js | Whole `app/` folder: every page, layout, metadata, sitemap, images |
| 🗂 Site | Static site zip: pages, CSS, images, sitemap, robots.txt |
| 📄 design.md | Your design system as tokens |
| 🧾 JSON | The sketch itself. Commit it, reopen it, build it with the CLI |

## 🎨 Styles

100 built in, all pure design tokens, so switching never touches your structure. Hover a card in the picker to preview, or search by name or group.

| Group | Styles |
|-------|--------|
| 🏠 House | Plain, Editorial, Brutal, Soft, Terminal |
| 📰 Editorial · serif | Monochrome, Newsprint, Luxury, Academia, Botanical, Organic |
| 💼 Product · sans | SaaS, Swiss Minimalist, Flat Design, Material Design, Professional, Enterprise |
| 🎭 Expressive | Bauhaus, Neo Brutalism, Playful Geometric, Claymorphism, Neumorphism, Maximalism, Sketch, Industrial, Retro |
| 🌙 Dark | Modern Dark, Minimal Dark, Bold Typography, Kinetic, Web3, Art Deco, Vaporwave, Terminal (green), Cyberpunk |
| 🧑‍💻 Editor classics | Nord, Nord Light, Dracula, Solarized, Solarized Dark, Gruvbox, Catppuccin, Rosé Pine, Tokyo Night |
| ✨ Character | Blueprint, Riso, Matcha, Sunset, Oceanic, Candy, Glass, Corporate, Zine |
| ♿ Accessible | High Contrast |
| 💼 Looks · products | Clear Day, Paper Trail, Boardroom, Strong Room, Daybook |
| 🧑‍💻 Looks · developer | Bare Metal, Basalt, Piano Black, Night Launch, Control Room, Handbook, Nightfall, Draft Room, Garage |
| 🚀 Looks · launches and apps | First Light, Soft Launch, Daybreak, Playground, Night Swim |
| 🎬 Looks · studios and brands | Billboard, Poster, After Hours, Velvet, Ink Editorial, Lens |
| 🛍 Looks · shops and makers | Storefront, Sorbet, Brown Paper, North Light, Corkboard |
| 📰 Looks · writing and media | Sunday Paper, Lamplight, Postcard, Small Hours, Pressroom |
| 🎟 Looks · events | Lanyard, Marquee |
| 🏘 Looks · local and community | Main Street, Supper, Brickwork, Village Hall, Allotment |
| 📚 Looks · learning | Study Hall, Chalkboard, Exercise Book |
| 📊 Looks · reports | Field Report |

## ⌨️ CLI

```bash
npx github:imveersolanki/Mirage build sketch.json --target site --out dist
npx github:imveersolanki/Mirage build sketch.json --target next --out app
npx github:imveersolanki/Mirage check sketch.json     # exits 1 on errors
npx github:imveersolanki/Mirage css --all-themes      # the stylesheet on its own
```

The CLI runs the same core modules as the editor, so its pages match the editor's export byte for byte.

## 🔐 Privacy

- ✅ No login, no account
- ✅ No cookies, no analytics, no telemetry
- ✅ Projects live in your browser's IndexedDB
- ✅ Images are processed on your device and never uploaded
- ✅ API keys and tokens stay in your browser's localStorage
- ✅ The only network calls are the ones you ask for: Gemini, Netlify, PeerJS for live sessions across devices
- ✅ MIT licensed, read every line

### Your Data, Your Browser

Everything is local, which means:

- **Clear your browser data and your projects are gone.** Export JSON to keep a copy.
- **Another browser or device starts empty.** Use a share link or the JSON export to move a project.
- **Share links carry the sketch but not images.** Images go with the JSON export.

## 🛠 Tech Stack

- **Architecture**: Static HTML, CSS and vanilla JS. The editor is an ES module; feature modules attach through `window.Mirage`
- **Core**: Pure modules in `js/core/` shared by the editor, the CLI and the tests
- **Storage**: IndexedDB (projects, snippets) and localStorage (settings)
- **Live**: BroadcastChannel across tabs, WebRTC via PeerJS across devices
- **AI**: Gemini REST, called straight from the browser
- **Tests**: `node --test` and Playwright, run in GitHub Actions

## 📁 Project Structure

```
Mirage/
├── index.html              # Landing page
├── mirage/index.html       # The editor
├── gallery/                # Example sketches you can open or download
├── js/
│   ├── core/               # Classifier, markup, CSS, JSX, page head (browser + Node)
│   ├── mirage.js           # Editor engine
│   └── mirage-*.js         # Tools, import, AI, live, media, checks, components, styles
├── css/                    # Landing, editor, 100 styles
├── packages/ui/            # @mirage/ui React components
├── cli/mirage.mjs          # npx mirage build | check | css
├── figma-plugin/           # Figma ↔ Mirage
├── tests/                  # Unit tests and Playwright end-to-end tests
├── docs/launch.md          # Launch copy
└── README.md               # This file
```

## 🧪 Tests

```bash
npm install
npm test            # classifier, markup, CLI, @mirage/ui, Figma plugin, style contrast and duplicates
npm run test:e2e    # the editor in Chromium
```

## 🤝 Contributing

Contributions are welcome. The most useful thing you can send is a sketch Mirage misreads: export the JSON and open an issue with what you expected. Add it to `tests/classify.test.mjs` and fix the rule in `js/core/classify.js`.

## 📜 License

**MIT** — use it, fork it, ship it.

## ◻️

> A wireframe already says what it is.
> Position, proportion, and what sits beside what.
> You should not have to describe it twice.

**Drawn, not configured.**

---

Made with 🖤 by [Veer](https://github.com/imveersolanki) for CodeStorm 2026
