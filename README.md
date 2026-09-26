# Little Isle

A playable, original Animal Crossing-inspired island life game. Built with React, TypeScript, and Three.js; every island object is modeled procedurally.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. A WebGL-capable browser is required.

```sh
npm test        # Game rules and persistence regression tests
npm run build  # Type check and production build
npm run preview
```

## Your island day

- **WASD / arrow keys** to walk, or click a place to navigate there.
- **E** to interact nearby. Clicking a tree, neighbor, or building walks there and interacts automatically.
- **1–4** to equip hands, bug net, fishing rod, or shovel.
- Gather peaches, wood, stone, seashells, butterflies, and fish. When fishing, press **Space** or **Reel it in** while the marker is green.
- Meet Maple the bear, Pip the duck, and Clover the rabbit.
- Visit Fern & Fig Market to sell collected items and purchase wildflower seeds.
- Choose **Decorate** to place flower patches, benches, and lanterns in a clear nearby spot.
- Complete goals in the island journal and collect bell rewards.
- Visit your cottage and rest to begin a new day and replenish resources.
- **B** opens pockets, **M** opens the map, **G** opens the journal, and **Escape** closes panels.

Settings let you name the island, choose sunny daylight, golden hour or night, toggle a synthesized ambient soundtrack, and start fresh. Progress saves automatically in this browser's local storage. The game runs entirely locally with no account, server, or API keys. Google Fonts is used for the interface with local serif/sans-serif fallbacks.

## Project structure

- `src/game/scene.ts`: 3D artwork, lighting, animation, collision and A* navigation.
- `src/game/world.ts`: island landmarks and interactive entities.
- `src/game/engine.ts`: inventory, economy, quests, day progression and validated saves.
- `src/App.tsx`: HUD, maps, inventory, journal, shops and fishing.
- `src/styles.css`: responsive interface and accessibility motion preferences.

This is an original small-scale browser game inspired by the cozy life-sim genre, with its own art, characters, and setting. It is not affiliated with Nintendo.
