# Launch kit: Mirage v0.7

Everything here is a draft to edit in your own voice. Links assume the site is
at mirageui.vercel.app and the repo at github.com/Veer1778/Mirage.

## Product Hunt

**Name:** Mirage

**Tagline (60 chars max):** Draw a wireframe, get the page. No prompt required.

**Description (260 chars max):**
Mirage reads a wireframe the way a person does: where a box sits, how tall it
is for its width, what sits beside it. Draw boxes or photograph a paper sketch,
and it builds the page, checks it, and exports HTML, React, Next.js and more.

**Topics:** Design Tools, Developer Tools, Open Source, No-Code

**Gallery (in order):** screenshots of the editor and `gallery/thumbs/*.webp`. Take fresh
editor screenshots at 1270×760: an imported paper sketch, the AI panel, two
people in a live session, and the Export panel.

**Maker's first comment:**
> Hi! I'm Veer, a designer and developer from Faridabad. I built Mirage for
> CodeStorm 2026 because every "AI website builder" starts with a prompt, and
> I think in boxes, not paragraphs.
>
> Mirage has no prompt. It reads geometry: a full-width box at the top is a
> nav, three equal boxes in a row are a card grid, a tall narrow box beside
> text is a rail. When it's unsure it tells you, shows what else the box
> could be, and remembers when you correct it.
>
> v0.7 adds the part I'm proudest of: take a photo of a sketch on paper and
> it straightens it, closes the gaps in your lines, and finds every box
> (including boxes inside boxes and the X-through-a-box image convention).
> Everything runs in your browser, nothing is uploaded, and it's MIT licensed.
>
> I'd love to know what it misreads. That's how the classifier gets better.

## Show HN

**Title:** Show HN: Mirage – draw a wireframe (or photograph one) and get the page

**Text:**
Mirage is an open source frontend builder that classifies boxes by geometry
instead of taking a prompt. Position, proportion and adjacency decide what a
box is; you can override any reading and it sticks.

Things that might interest HN:
- The classifier is about 60 lines of ordered rules with confidences, and it
  shows the runner-up readings instead of hiding them. Tests pin what common
  layouts read as.
- Photo import is plain canvas code: adaptive threshold, projection-profile
  deskew, collinear gap bridging that refuses to bridge at corners, flood
  fill, and a rectangularity test. No model, no upload.
- Live editing is peer to peer (BroadcastChannel across tabs, WebRTC across
  devices) with a per-box last-writer-wins merge and tombstones.
- No build step. The editor is static files; the same core modules run the
  CLI (`npx github:Veer1778/Mirage build sketch.json --target next`).

Demo: mirageui.vercel.app · Code: github.com/Veer1778/Mirage

## X thread

1. I got tired of describing websites to AI in paragraphs. So I built a tool where you just draw boxes. Mirage reads the geometry and builds the page. No prompt. 🧵
2. A full-width box at the top is a nav. Three equal boxes in a row are cards. A tall narrow box is a rail. If it's unsure, it shows you what else it could be. [screenshot of "also reads as"]
3. New: photograph a sketch on paper. It straightens the photo, fixes broken lines, finds boxes inside boxes, and reads your handwritten labels. [screenshot of an imported sketch]
4. Then: AI copy with your own key, live editing with friends, accessibility and SEO checks, and export to HTML, React, Vue, Svelte, Astro, Next.js or a deployed site. [screenshot of Export]
5. It's open source, runs entirely in your browser, no account. Try it: mirageui.vercel.app

## LinkedIn

Shipped v0.7 of Mirage, the sketch-to-site builder I started for CodeStorm 2026.

The idea: instead of prompting an AI with a paragraph, you draw boxes, and the
tool reads them the way a designer would. A box's position, proportions and
neighbours decide whether it's a nav, a hero, a card grid or an image.

This release adds photo import (sketch on paper, take a picture, get the
page), multi-page sites with SEO, real images, accessibility checks, live
collaboration, a Figma plugin, a CLI for CI, and a React component package.

It's MIT licensed and runs entirely in the browser. Feedback very welcome,
especially sketches it misreads.

## Checklist before launch

- [ ] Publish `@mirage/ui` to npm (`cd packages/ui && npm run build && npm publish --access public`), or change the README to point at the GitHub path.
- [ ] Submit the Figma plugin for review (Figma desktop → Plugins → Development → Publish).
- [ ] Try Gemini, Netlify deploy and two-device live sessions once on real networks.
- [ ] Post Tuesday to Thursday, 12:01am Pacific for Product Hunt.
