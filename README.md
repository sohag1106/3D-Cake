# Atelier Crème — 3D Cake Design Studio

A real-time 3D cake configurator. A customer composes a cake — shape, size,
tiers, sponge, filling, finish, toppers, candles and inscription — sees it
render live, and sends the design to the shop as an order.

Built with React 19, Vite 7 and pure Three.js (no react-three-fiber). Every
surface and material is generated procedurally at runtime: there are no image
assets in the repository.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle into dist/
npm run preview  # serve the built bundle
```

## Layout

```
src/
  App.jsx            app shell, modals, order flow
  data/catalog.js    shapes, sizes, tiers, flavours, fillings, frostings,
                     toppers, boards and the price tables
  lib/
    pricing.js       DEFAULT_DESIGN and the quote calculation
    store.js         design state, undo/redo, saved designs, randomize
    textures.js      procedural CanvasTexture painters (albedo + normal)
    utils.js         colours, rng, formatting
  three/
    studio.js        renderer, lighting, environment, frosting materials
    shapes.js        cake geometry and hand-built UVs
    toppers.js       topper geometry
  ui/
    Rail.jsx         the design panel: tabs, options, summary
    Viewport.jsx     the 3D stage, camera tools, backdrop chips
    styles.css       all styling, mobile-first
.smoke/              headless Chrome checks driven over CDP
```

## Notes

Frosting textures are painted to a canvas at load and cached per finish. The
piped-buttercream finish (the default) carries most of its detail in its normal
map, so it gets a stronger relief than the other finishes.
