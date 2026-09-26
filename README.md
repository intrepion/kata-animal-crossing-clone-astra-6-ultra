# Little Isle

An original Animal Crossing: New Horizons-inspired browser game built around close-up village life. Walk through a 3D island, get to know its residents, catch fish and bugs, and furnish a home of your own.

Built with React, TypeScript, and Three.js. All 3D scenery, characters, and furniture are modeled procedurally.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite in a WebGL-capable browser.

```sh
npm test         # Inventory, economy, migration, friendships, furniture, and housing
npm run test:ui  # Dialogue and gameplay integration in a DOM test environment
npm run build    # Type checking and production build
npm run check    # All of the above
npm run preview  # Serve the production build
```

## Island life

The camera follows your character as you walk. Neighbors roam around their favorite places and stop to talk when you approach. The world stays visible during conversations and fishing; menus are tucked into the island phone.

Meet Maple the bear, Pip the duck, and Clover the rabbit. Each has a personality and a daily request. Bring the requested items back, hand them over in conversation, and earn friendship and bells. Conversations and requests renew when you begin a new day.

Shake peach trees, pick up shells, collect stone, and catch butterflies. To fish, equip your rod and approach a fish. Cast, wait for the bobber to dip, then press **E** or **Space** while the bite prompt is visible.

Visit **Fern & Fig** to sell your finds and buy furniture or flower seeds. Furniture appears as a leaf in your pockets. Walk through your cottage door to enter a furnished, walkable room. Place purchased pieces, then click a piece to move it on a half-unit grid, rotate it, or put it back in your pockets. Flowers, benches, and lanterns can be placed outdoors.

Your house starts with a bed, table, plant, and rug. Pay 9,800 bells toward an expansion to unlock a larger room. Rest in your bed to start a new day; collected resources return and your relationships and belongings remain.

## Controls

| Action | Control |
| --- | --- |
| Walk | WASD, arrow keys, or click the ground |
| Interact | E, or click an object or neighbor |
| Equip hands / net / rod / shovel | 1 / 2 / 3 / 4 |
| Tool wheel | Tab, or click the equipped tool |
| Pockets | B |
| Island phone | P |
| Map | M |
| Island milestones | G |
| Furnish indoors / decorate outdoors | F |
| Reveal dialogue / confirm a choice | E or Space |
| Select dialogue choice | Up / Down |
| Rearrange selected furniture | Arrow keys; R rotates |
| Close or cancel | Escape |

Settings offer three camera distances, daylight/sunset/night, an optional synthesized soundtrack, and island naming. Starting a new island requires confirmation.

## Saves

Progress saves automatically in this browser's local storage under `clover-island-save-v1`. Existing saves from the original diorama build migrate without losing bells, items, goals, or decorations. New friendship and home fields are added during loading. Interior movement does not overwrite the saved outdoor position.

The game requires no account, backend, or API key. The interface uses Google Fonts with system-font fallbacks.

## Source

- `src/game/scene.ts`: camera, world, characters, movement, navigation, and action animation.
- `src/game/interior.ts`: room, furniture geometry, placement, and collision.
- `src/game/world.ts`: outdoor entities and landmarks.
- `src/game/engine.ts`: validated state, saves, economy, requests, and housing progression.
- `src/App.tsx`: HUD, menus, fishing, conversations, and furnishing controls.
- `src/components/`: island map, item artwork, and keyboard-accessible dialogue.

This is a small original game inspired by the life-sim genre. It is not affiliated with Nintendo.
