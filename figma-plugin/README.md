# Mirage for Figma

Moves wireframes between Figma and Mirage without copy-pasting SVG.

- **Figma to Mirage:** select frames and click *Convert selection*. Each frame
  becomes a page. Rectangles and frames inside it become boxes on Mirage's
  16-column grid, and frames inside frames become nested boxes. A layer named
  like a component ("Hero", "Nav", "Pricing", "img") sets that box's type; the
  rest are read from their shape as usual. Open the result in Mirage with
  *Projects → Open .json*.
- **Mirage to Figma:** in Mirage, *Export → JSON*, paste it into the plugin and
  click *Create frames*. You get one frame per page with every box named by
  what Mirage read it as.

## Install (development)

Figma desktop → *Plugins → Development → Import plugin from manifest…* →
choose `figma-plugin/manifest.json`. No build step, no network access.
