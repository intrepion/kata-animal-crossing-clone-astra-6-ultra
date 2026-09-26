import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  claimTask, createNewGame, DECORATION_INFO, interactWith, ITEM_INFO,
  loadGame, nextDay, placeDecoration, saveGame, sellItems, STORAGE_KEY,
  TASKS, taskProgress,
} from './engine.ts';
import type { GameState, WorldEntity } from './types.ts';

const tree: WorldEntity = { id: 'tree-1', kind: 'tree', x: 1, z: 2, name: 'Peach tree' };
const fish: WorldEntity = { id: 'fish-1', kind: 'fish', x: 3, z: 4, name: 'River fish' };

test('new games have independent pockets, decorations, and journals', () => {
  const first = createNewGame();
  first.inventory.peach = 99;
  first.gathered.push(tree.id);
  first.decorations.push({ id: 'test', kind: 'bench', x: 0, z: 0 });
  const second = createNewGame();
  assert.equal(second.inventory.peach, 0);
  assert.equal(second.inventory.flower, 3);
  assert.deepEqual(second.gathered, []);
  assert.deepEqual(second.decorations, []);
});

test('the wrong tool explains what to equip and does not collect or mutate anything', () => {
  const before = createNewGame();
  const result = interactWith(before, fish);
  assert.equal(result.kind, 'info');
  assert.match(result.message, /fishing rod/i);
  assert.strictEqual(result.state, before);
  assert.equal(before.inventory.fish, 0);
});

test('a resource can only be gathered once per day', () => {
  const before = createNewGame();
  const first = interactWith(before, tree);
  assert.equal(first.state.inventory.peach, 2);
  assert.equal(first.state.inventory.wood, 1);
  assert.equal(first.state.lifetime.gathered, 3);
  assert.equal(before.inventory.peach, 0);
  const repeated = interactWith(first.state, tree);
  assert.strictEqual(repeated.state, first.state);
  assert.match(repeated.message, /tomorrow/);
});

test('each resource uses the correct tool and updates its inventory', () => {
  let state = createNewGame();
  const cases = [
    { kind: 'rock', tool: 'shovel', item: 'stone', count: 2 },
    { kind: 'fish', tool: 'rod', item: 'fish', count: 1 },
    { kind: 'butterfly', tool: 'net', item: 'butterfly', count: 1 },
    { kind: 'shell', tool: 'hand', item: 'shell', count: 1 },
  ] as const;
  for (const entry of cases) {
    state = { ...state, tool: entry.tool };
    state = interactWith(state, { id: entry.kind, kind: entry.kind, x: 0, z: 0, name: entry.kind }).state;
    assert.equal(state.inventory[entry.item], entry.count);
  }
  assert.equal(state.lifetime.gathered, 5);
  assert.equal(state.lifetime.fish, 1);
});

test('meeting a neighbor counts once and talking again stays available', () => {
  const neighbor: WorldEntity = { id: 'neighbor-1', kind: 'villager', x: 0, z: 0, name: 'Poppy' };
  const first = interactWith(createNewGame(), neighbor);
  assert.equal(first.kind, 'dialogue');
  assert.equal(first.speaker, 'Poppy');
  assert.deepEqual(first.state.met, ['Poppy']);
  const repeated = interactWith(first.state, neighbor);
  assert.equal(repeated.kind, 'dialogue');
  assert.strictEqual(repeated.state, first.state);
  assert.match(repeated.message, /again/);
});

test('wishes require their objective and rewards cannot be claimed twice', () => {
  const task = TASKS.find((entry) => entry.metric === 'fish')!;
  const before = createNewGame();
  assert.strictEqual(claimTask(before, task.id).state, before);
  const caught = interactWith({ ...before, tool: 'rod' }, fish).state;
  const claimed = claimTask(caught, task.id).state;
  assert.equal(taskProgress(caught, task), 1);
  assert.equal(claimed.bells, before.bells + task.reward);
  assert.deepEqual(claimed.completed, [task.id]);
  assert.strictEqual(claimTask(claimed, task.id).state, claimed);
  assert.strictEqual(claimTask(claimed, 'made-up-task').state, claimed);
});

test('selling clears saleable items, pays their exact value, and retains seeds', () => {
  const before = createNewGame();
  before.inventory = { peach: 2, wood: 1, stone: 2, shell: 1, fish: 1, butterfly: 1, flower: 3 };
  const expected = 2 * ITEM_INFO.peach.price + ITEM_INFO.wood.price
    + 2 * ITEM_INFO.stone.price + ITEM_INFO.shell.price + ITEM_INFO.fish.price + ITEM_INFO.butterfly.price;
  const after = sellItems(before).state;
  assert.equal(after.bells, before.bells + expected);
  assert.equal(after.lifetime.sold, 8);
  assert.deepEqual(after.inventory, { peach: 0, wood: 0, stone: 0, shell: 0, fish: 0, butterfly: 0, flower: 3 });
  assert.equal(before.inventory.peach, 2);
  assert.strictEqual(sellItems(after).state, after);
});

test('decoration purchases cannot overdraw bells or flower seeds', () => {
  const before = { ...createNewGame(), bells: DECORATION_INFO.bench.price - 1 };
  assert.strictEqual(placeDecoration(before, 'bench', { x: 0, z: 0 }).state, before);
  const funded = createNewGame();
  const bench = placeDecoration(funded, 'bench', { x: 2, z: 3 }).state;
  assert.equal(bench.bells, funded.bells - DECORATION_INFO.bench.price);
  assert.equal(bench.decorations[0].kind, 'bench');
  assert.equal(bench.inventory.flower, 3);
  let planted = funded;
  for (let i = 0; i < 3; i += 1) planted = placeDecoration(planted, 'flowers', { x: i, z: 1 }).state;
  assert.equal(planted.inventory.flower, 0);
  assert.equal(planted.lifetime.planted, 3);
  assert.equal(planted.bells, funded.bells);
  assert.strictEqual(placeDecoration(planted, 'flowers', { x: 4, z: 1 }).state, planted);
  assert.strictEqual(placeDecoration(planted, 'lantern', { x: NaN, z: 1 }).state, planted);
  assert.equal(new Set(planted.decorations.map((decoration) => decoration.id)).size, 3);
});

test('a new day refreshes resources and keeps possessions, rewards, and friendships', () => {
  let before = interactWith(createNewGame(), tree).state;
  before = placeDecoration(before, 'flowers', { x: 1, z: 1 }).state;
  before = interactWith(before, { id: 'neighbor', kind: 'villager', name: 'Poppy', x: 0, z: 0 }).state;
  before = claimTask(before, TASKS.find((task) => task.metric === 'planted')!.id).state;
  before = { ...before, timeOfDay: 'night' };
  const after = nextDay(before);
  assert.equal(after.day, before.day + 1);
  assert.equal(after.timeOfDay, 'day');
  assert.deepEqual(after.gathered, []);
  for (const field of ['inventory', 'decorations', 'completed', 'lifetime', 'met', 'bells'] as const) {
    assert.deepEqual(after[field], before[field]);
  }
  assert.equal(interactWith(after, tree).state.inventory.peach, 4);
  assert.deepEqual(before.gathered, [tree.id]);
});

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

function useStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return storage;
}

test('progress round-trips through local storage', () => {
  useStorage();
  let state = interactWith(createNewGame(), tree).state;
  state = placeDecoration(state, 'lantern', { x: 3, z: -4 }).state;
  state = { ...state, name: 'Juniper', sound: true, timeOfDay: 'sunset' };
  assert.equal(saveGame(state), true);
  assert.deepEqual(loadGame(), state);
});

test('malformed, partial, and invalid saves recover to a fresh game', () => {
  const invalidStates: unknown[] = [
    null, [], {}, { version: 1 },
    { ...createNewGame(), version: 2 },
    { ...createNewGame(), bells: -1 },
    { ...createNewGame(), day: 0 },
    { ...createNewGame(), sound: 'true' },
    { ...createNewGame(), name: ' ' },
    { ...createNewGame(), tool: 'axe' },
    { ...createNewGame(), timeOfDay: 'midnight' },
    { ...createNewGame(), player: { x: null, z: 1 } },
    { ...createNewGame(), inventory: { ...createNewGame().inventory, peach: 1.5 } },
    { ...createNewGame(), lifetime: { gathered: 0 } },
    { ...createNewGame(), met: ['Poppy', 'Poppy'] },
    { ...createNewGame(), completed: ['unknown-task'] },
    { ...createNewGame(), decorations: [{ id: '1', kind: 'castle', x: 0, z: 0 }] },
    { ...createNewGame(), decorations: [{ id: '1', kind: 'bench', x: 0, z: 0 }, { id: '1', kind: 'bench', x: 1, z: 1 }] },
  ];
  const storage = useStorage('{not-json');
  assert.deepEqual(loadGame(), createNewGame());
  for (const value of invalidStates) {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    assert.deepEqual(loadGame(), createNewGame());
  }
});

test('storage failures are contained and non-finite state is never saved', () => {
  useStorage();
  assert.equal(saveGame({ ...createNewGame(), bells: NaN }), false);
  assert.equal(saveGame({ ...createNewGame(), player: { x: Infinity, z: 0 } }), false);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('Storage unavailable'); },
  });
  assert.deepEqual(loadGame(), createNewGame());
  assert.equal(saveGame(createNewGame()), false);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } },
  });
  assert.equal(saveGame(createNewGame()), false);
});

test('wallet overflow cannot corrupt a sale or reward', () => {
  const state: GameState = { ...createNewGame(), bells: Number.MAX_SAFE_INTEGER };
  state.inventory.peach = 1;
  state.lifetime.fish = 1;
  assert.strictEqual(sellItems(state).state, state);
  assert.strictEqual(claimTask(state, TASKS.find((task) => task.metric === 'fish')!.id).state, state);
});
