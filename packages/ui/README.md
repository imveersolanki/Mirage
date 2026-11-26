# @mirage/ui

The React components Mirage's React export imports. They render exactly the
markup the HTML export does, so one stylesheet styles both.

```bash
npm i @mirage/ui
```

```jsx
import { Nav, Hero, Row, Figure, Prose } from '@mirage/ui'
import '@mirage/ui/mirage.css'

export default function Page() {
  return (
    <main className="page">
      <Nav t={{ brand: 'Crumb & Co' }} />
      <Hero t={{ heroH: 'Sourdough by 8am' }} />
      <Row cols={[7, 9]}>
        <Figure t={{ 'img:src': '/loaf.webp', 'img:alt': 'A sourdough loaf' }} />
        <Prose t={{ textH: 'Baked at 4am' }} />
      </Row>
    </main>
  )
}
```

Every component takes `t` (text overrides; anything you leave out uses the
default), plus `align`, `shape`, `columns`, `hideOn={['tablet','phone']}` and
`firstOnPhone` where they apply. `Row` takes `cols` and `stack="tablet"|"never"`.

Not on npm yet? The editor's React download includes this file as
`mirage-ui.jsx`, so exported pages work without installing anything.

Build: `npm run build` (esbuild for the JS, the Mirage CLI for the CSS).
