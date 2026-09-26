import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  claimTask, createNewGame, DECORATION_INFO, interactWith, ITEM_INFO,
  loadGame, nextDay, placeDecoration, saveGame, sellItems, STORAGE_KEY,
  TASKS, taskProgress, buyFurniture, fulfillRequest, FURNITURE_INFO,
  getVillagerDialogue, moveFurniture, payHomeDebt, placeFurniture, returnFurniture, VILLAGER_INFO,
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

const maple: WorldEntity = { id: 'mabel', kind: 'villager', name: 'Maple', x: 0, z: 0 };

test('legacy v1 saves retain possessions and progression while gaining a furnished home', () => {
  let prior = interactWith(createNewGame(), tree).state;
  prior = placeDecoration(prior, 'flowers', { x: 3, z: 2 }).state;
  prior = claimTask(prior, TASKS.find((entry) => entry.metric === 'planted')!.id).state;
  prior = { ...prior, day: 7, name: 'Juniper', met: ['Maple'], sound: true, timeOfDay: 'sunset' };
  const { friendships: _friendships, requests: _requests, furniture: _furniture, room: _room,
    homeLevel: _homeLevel, homeDebt: _homeDebt, ...legacy } = prior;
  useStorage(JSON.stringify(legacy));
  const restored = loadGame();
  for (const [key, value] of Object.entries(legacy)) assert.deepEqual(restored[key as keyof GameState], value);
  assert.deepEqual(restored.furniture, createNewGame().furniture);
  assert.deepEqual(restored.room, createNewGame().room);
  assert.equal(restored.friendships.mabel, 1);
  assert.equal(restored.friendships.pip, 0);
  assert.equal(restored.homeDebt, 9800);
  assert.equal(saveGame(restored), true);
  assert.deepEqual(loadGame(), restored);
});

test('neighbor personalities are stable and greetings grow friendship once per day', () => {
  const before = createNewGame();
  const mapleGreeting = getVillagerDialogue(before, 'mabel');
  assert.match(mapleGreeting.message, /honeybun/);
  assert.match(getVillagerDialogue(before, 'pip').message, /skipper/);
  assert.match(getVillagerDialogue(before, 'clover').message, /petal/);
  assert.equal(before.friendships.mabel, 0, 'Reading dialogue must not award points');
  const greeted = interactWith(before, maple).state;
  assert.equal(greeted.friendships.mabel, 1);
  assert.strictEqual(interactWith(greeted, maple).state, greeted);
  assert.deepEqual(greeted.met, ['Maple']);
  const tomorrow = nextDay(greeted);
  assert.equal(tomorrow.friendships.mabel, 1);
  assert.notEqual(getVillagerDialogue(greeted, 'mabel').message, getVillagerDialogue(tomorrow, 'mabel').message);
  assert.equal(interactWith(tomorrow, maple).state.friendships.mabel, 2);
});

test('partially upgraded saves retain a paid-off home when a paired field is missing', () => {
  const paid = { ...createNewGame(), name: 'Juniper', homeLevel: 1, homeDebt: 0 };
  const { homeDebt: _debt, ...withoutDebt } = paid;
  const storage = useStorage(JSON.stringify(withoutDebt));
  assert.deepEqual(loadGame(), paid);
  const { homeLevel: _level, ...withoutLevel } = paid;
  storage.setItem(STORAGE_KEY, JSON.stringify(withoutLevel));
  assert.deepEqual(loadGame(), paid);
});

test('requests require a daily greeting and sufficient items before making an atomic delivery', () => {
  const before = createNewGame();
  before.inventory.peach = 3;
  assert.strictEqual(fulfillRequest(before, 'mabel').state, before);
  const greeted = interactWith(before, maple).state;
  assert.equal(getVillagerDialogue(greeted, 'mabel').request?.canDeliver, true);
  const insufficient = { ...greeted, inventory: { ...greeted.inventory, peach: 2 } };
  assert.strictEqual(fulfillRequest(insufficient, 'mabel').state, insufficient);
  assert.equal(getVillagerDialogue(insufficient, 'mabel').request?.canDeliver, false);
  const delivered = fulfillRequest(greeted, 'mabel').state;
  assert.equal(delivered.inventory.peach, 0);
  assert.equal(delivered.bells, greeted.bells + VILLAGER_INFO.mabel.request.reward);
  assert.equal(delivered.friendships.mabel, 4);
  assert.deepEqual(delivered.requests.mabel, { day: 1, delivered: true });
  assert.equal(greeted.inventory.peach, 3);
  assert.strictEqual(fulfillRequest(delivered, 'mabel').state, delivered);
  assert.equal(getVillagerDialogue(delivered, 'mabel').request?.delivered, true);
  assert.equal(getVillagerDialogue(delivered, 'mabel').request?.canDeliver, false);
});

test('a fresh day renews requests without clearing friendships or granting duplicate rewards', () => {
  let state = createNewGame();
  state.inventory.peach = 6;
  state = fulfillRequest(interactWith(state, maple).state, 'mabel').state;
  const tomorrow = nextDay(state);
  assert.equal(getVillagerDialogue(tomorrow, 'mabel').request?.delivered, false);
  assert.strictEqual(fulfillRequest(tomorrow, 'mabel').state, tomorrow);
  const talked = interactWith(tomorrow, maple).state;
  const delivered = fulfillRequest(talked, 'mabel').state;
  assert.equal(delivered.inventory.peach, 0);
  assert.equal(delivered.friendships.mabel, 8);
  assert.equal(delivered.bells, createNewGame().bells + 2 * VILLAGER_INFO.mabel.request.reward);
  assert.strictEqual(fulfillRequest(delivered, 'mabel').state, delivered);
});

test('purchased furniture conserves bells and copies through placement, movement, and packing', () => {
  const before = createNewGame();
  const purchased = buyFurniture(before, 'chair').state;
  assert.equal(purchased.bells, before.bells - FURNITURE_INFO.chair.price);
  assert.equal(purchased.furniture.chair, 1);
  const placed = placeFurniture(purchased, 'chair', { x: 2.5, z: 1.7 }).state;
  assert.equal(placed.furniture.chair, 0);
  assert.equal(placed.room.length, before.room.length + 1);
  assert.equal(placed.bells, purchased.bells);
  const chair = placed.room.find((item) => item.kind === 'chair')!;
  const moved = moveFurniture(placed, chair.id, { x: -2.5, z: 2.1 }, 1).state;
  assert.equal(moved.room.length, placed.room.length);
  assert.deepEqual(moved.room.find((item) => item.id === chair.id), { ...chair, x: -2.5, z: 2.1, rotation: 1 });
  assert.equal(moved.bells, placed.bells);
  const packed = returnFurniture(moved, chair.id).state;
  assert.equal(packed.furniture.chair, 1);
  assert.equal(packed.room.length, before.room.length);
  assert.equal(packed.bells, purchased.bells);
  assert.strictEqual(returnFurniture(packed, chair.id).state, packed);
  assert.equal(before.furniture.chair, 0);
});

test('furniture cannot be purchased without funds, duplicated, or placed through walls and solids', () => {
  const poor = { ...createNewGame(), bells: FURNITURE_INFO.bed.price - 1 };
  assert.strictEqual(buyFurniture(poor, 'bed').state, poor);
  const before = createNewGame();
  assert.strictEqual(placeFurniture(before, 'chair', { x: 2, z: 2 }).state, before);
  const purchased = buyFurniture(before, 'chair').state;
  assert.strictEqual(placeFurniture(purchased, 'chair', { x: -2, z: -1 }).state, purchased);
  assert.strictEqual(placeFurniture(purchased, 'chair', { x: 4, z: 0 }).state, purchased);
  assert.strictEqual(placeFurniture(purchased, 'chair', { x: 0, z: 2.5 }).state, purchased, 'The front doorway must stay usable');
  assert.strictEqual(placeFurniture(purchased, 'chair', { x: NaN, z: 0 }).state, purchased);
  assert.strictEqual(placeFurniture(purchased, 'chair', { x: 2, z: 2 }, .5).state, purchased);
  const placed = placeFurniture(purchased, 'chair', { x: 2, z: 2 }).state;
  assert.strictEqual(placeFurniture(placed, 'chair', { x: -2, z: 2 }).state, placed);
  const chair = placed.room.find((item) => item.kind === 'chair')!;
  assert.strictEqual(moveFurniture(placed, chair.id, { x: 4, z: 2 }).state, placed);
  assert.strictEqual(moveFurniture(placed, chair.id, { x: 1, z: -1 }).state, placed);
});

test('rotated furniture uses its actual footprint and rugs can sit below furniture', () => {
  const roomless = { ...createNewGame(), room: [] };
  const purchased = buyFurniture(roomless, 'bed').state;
  assert.notStrictEqual(placeFurniture(purchased, 'bed', { x: 3, z: 0 }, 0).state, purchased);
  assert.strictEqual(placeFurniture(purchased, 'bed', { x: 3, z: 0 }, 1).state, purchased);
  const rug = buyFurniture(createNewGame(), 'rug').state;
  const layered = placeFurniture(rug, 'rug', { x: -2, z: -1 }).state;
  assert.equal(layered.room.length, rug.room.length + 1);
  const chair = buyFurniture(roomless, 'chair').state;
  const aboveRug = { ...chair, room: createNewGame().room.filter((item) => item.kind === 'rug') };
  assert.notStrictEqual(placeFurniture(aboveRug, 'chair', { x: 0, z: .6 }).state, aboveRug);
});

test('home payments reject unaffordable amounts and expand only after the final exact balance', () => {
  const before = createNewGame();
  for (const amount of [-1, 0, .5, NaN, Infinity, 3000]) assert.strictEqual(payHomeDebt(before, amount).state, before);
  const partial = payHomeDebt(before, 2000).state;
  assert.equal(partial.bells, 400);
  assert.equal(partial.homeDebt, 7800);
  assert.equal(partial.homeLevel, 0);
  const funded = { ...partial, bells: 8000 };
  const paid = payHomeDebt(funded, 8000).state;
  assert.equal(paid.bells, 200, 'Overpayment is limited to the remaining debt');
  assert.equal(paid.homeDebt, 0);
  assert.equal(paid.homeLevel, 1);
  assert.strictEqual(payHomeDebt(paid, 100).state, paid);
  const furnished = { ...paid, furniture: { ...paid.furniture, chair: 1 } };
  assert.notStrictEqual(placeFurniture(furnished, 'chair', { x: 4.4, z: 0 }).state, furnished);
  const smallRoom = { ...furnished, homeLevel: 0, homeDebt: 100 };
  assert.strictEqual(placeFurniture(smallRoom, 'chair', { x: 4.4, z: 0 }).state, smallRoom);
});

test('new progression persists and malformed progression cannot enter the game', () => {
  useStorage();
  let state = interactWith(createNewGame(), maple).state;
  state = buyFurniture(state, 'radio').state;
  state = payHomeDebt(state, 1000).state;
  assert.equal(saveGame(state), true);
  assert.deepEqual(loadGame(), state);
  const invalid: unknown[] = [
    { ...state, friendships: { mabel: -1 } },
    { ...state, requests: { mabel: { day: state.day + 1, delivered: true } } },
    { ...state, furniture: { ...state.furniture, chair: .5 } },
    { ...state, room: [{ id: 'invalid', kind: 'bed', x: 20, z: 0, rotation: 0 }] },
    { ...state, room: [{ id: 'invalid', kind: 'bed', x: 0, z: 0, rotation: 4 }] },
    { ...state, homeDebt: -1 },
    { ...state, homeDebt: 0, homeLevel: 0 },
    { ...state, homeLevel: 1, homeDebt: 100 },
  ];
  const storage = useStorage();
  for (const value of invalid) {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    assert.deepEqual(loadGame(), createNewGame());
  }
});
