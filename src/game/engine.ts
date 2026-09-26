import type { DecorationKind, GameState, ItemId, Position, Tool, WorldEntity } from './types.ts';

export const STORAGE_KEY = 'clover-island-save-v1';

export const ITEM_INFO: Record<ItemId, { name: string; price: number; emoji: string; description: string }> = {
  peach: { name: 'Peach', price: 100, emoji: '🍑', description: 'A little island sunshine, perfectly ripe.' },
  wood: { name: 'Wood', price: 60, emoji: '🪵', description: 'A sturdy branch with a world of possibilities.' },
  stone: { name: 'Stone', price: 75, emoji: '🪨', description: 'Smooth, solid, and surprisingly lovely.' },
  shell: { name: 'Seashell', price: 80, emoji: '🐚', description: 'A tiny treasure washed up by the tide.' },
  fish: { name: 'River fish', price: 240, emoji: '🐟', description: 'Fresh from the island waters. Quite a catch!' },
  butterfly: { name: 'Butterfly', price: 180, emoji: '🦋', description: 'A flutter of color for a very good day.' },
  flower: { name: 'Flower seeds', price: 0, emoji: '🌷', description: 'Plant these from Decorate to make the island yours.' },
};

export const TOOL_INFO: Record<Tool, { name: string; hint: string }> = {
  hand: { name: 'Empty hands', hint: 'Shake a peach tree or pick up a seashell.' },
  net: { name: 'Bug net', hint: 'Get close to a butterfly and catch it.' },
  rod: { name: 'Fishing rod', hint: 'Find a fish near the water and cast your line.' },
  shovel: { name: 'Shovel', hint: 'Tap an island rock to collect stone.' },
};

export const DECORATION_INFO: Record<DecorationKind, { name: string; price: number; description: string; emoji: string }> = {
  flowers: { name: 'Flower patch', price: 0, description: 'A happy little patch. Uses 1 flower seed.', emoji: '🌷' },
  bench: { name: 'Garden bench', price: 600, description: 'A place to slow down and take it all in.', emoji: '🪑' },
  lantern: { name: 'Island lantern', price: 350, description: 'A warm glow for those unhurried evenings.', emoji: '🏮' },
};

export interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  metric: 'gathered' | 'fish' | 'met' | 'planted' | 'sold';
}

export const TASKS: Task[] = [
  { id: 'gather-five', title: 'Pocketful of possibilities', description: 'Collect 5 island treasures.', reward: 300, target: 5, metric: 'gathered' },
  { id: 'meet-neighbors', title: 'A friendly little hello', description: 'Meet all 3 of your island neighbors.', reward: 500, target: 3, metric: 'met' },
  { id: 'first-fish', title: 'Something on the line', description: 'Catch your very first fish.', reward: 300, target: 1, metric: 'fish' },
  { id: 'plant-flowers', title: 'Room to bloom', description: 'Plant a flower patch from Decorate.', reward: 250, target: 1, metric: 'planted' },
  { id: 'first-sale', title: 'One islander’s treasure', description: 'Sell 5 collected items at the shop.', reward: 400, target: 5, metric: 'sold' },
];

export function createNewGame(): GameState {
  return {
    version: 1,
    name: 'Clover',
    bells: 2400,
    day: 1,
    inventory: { peach: 0, wood: 0, stone: 0, shell: 0, fish: 0, butterfly: 0, flower: 3 },
    gathered: [],
    met: [],
    decorations: [],
    completed: [],
    lifetime: { gathered: 0, fish: 0, sold: 0, planted: 0 },
    player: { x: 0, z: 5 },
    tool: 'hand',
    timeOfDay: 'day',
    sound: false,
  };
}

export const INITIAL_STATE: GameState = createNewGame();

const itemIds = Object.keys(ITEM_INFO) as ItemId[];
const tools = Object.keys(TOOL_INFO);
const decorationKinds = Object.keys(DECORATION_INFO);
const taskIds = new Set(TASKS.map((task) => task.id));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isLabel = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const isPosition = (value: unknown): value is Position => isRecord(value)
  && typeof value.x === 'number' && Number.isFinite(value.x)
  && typeof value.z === 'number' && Number.isFinite(value.z);
const isUniqueStringArray = (value: unknown): value is string[] => Array.isArray(value)
  && value.every(isLabel) && new Set(value).size === value.length;

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.version !== 1 || !isLabel(value.name)
    || !isCount(value.bells) || !isCount(value.day) || value.day < 1
    || !isRecord(value.inventory) || !isRecord(value.lifetime)
    || !isUniqueStringArray(value.gathered) || !isUniqueStringArray(value.met)
    || !isUniqueStringArray(value.completed) || !value.completed.every((id) => taskIds.has(id))
    || !Array.isArray(value.decorations) || !isPosition(value.player)
    || typeof value.tool !== 'string' || !tools.includes(value.tool)
    || !['day', 'sunset', 'night'].includes(value.timeOfDay as string)
    || typeof value.sound !== 'boolean') return false;

  const inventory = value.inventory;
  const lifetime = value.lifetime;
  if (!itemIds.every((id) => isCount(inventory[id]))
    || !['gathered', 'fish', 'sold', 'planted'].every((metric) => isCount(lifetime[metric]))) return false;

  const ids = new Set<string>();
  return value.decorations.every((decoration: unknown) => {
    if (!isRecord(decoration) || !isLabel(decoration.id)
      || typeof decoration.kind !== 'string' || !decorationKinds.includes(decoration.kind)
      || !isPosition(decoration) || ids.has(decoration.id)) return false;
    ids.add(decoration.id);
    return true;
  });
}

export function loadGame(): GameState {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!saved) return createNewGame();
    const parsed: unknown = JSON.parse(saved);
    return isGameState(parsed) ? parsed : createNewGame();
  } catch {
    return createNewGame();
  }
}

export function saveGame(state: GameState): boolean {
  try {
    if (!isGameState(state) || !globalThis.localStorage) return false;
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function taskProgress(state: GameState, task: Task): number {
  const progress = task.metric === 'met' ? state.met.length : state.lifetime[task.metric];
  return Math.min(task.target, progress);
}

interface StateMessage { state: GameState; message: string }
export interface InteractionResult extends StateMessage {
  kind: 'success' | 'info' | 'dialogue' | 'shop' | 'home';
  speaker?: string;
  reward?: number;
}

const harvest: Partial<Record<WorldEntity['kind'], { tool: Tool; items: Partial<Record<ItemId, number>>; message: string }>> = {
  tree: { tool: 'hand', items: { peach: 2, wood: 1 }, message: 'A sweet little windfall! +2 peaches and +1 wood.' },
  rock: { tool: 'shovel', items: { stone: 2 }, message: 'Rock solid! You collected 2 stones.' },
  fish: { tool: 'rod', items: { fish: 1 }, message: 'You caught a river fish! That’s quite a catch.' },
  butterfly: { tool: 'net', items: { butterfly: 1 }, message: 'A perfect little flutter. You caught a butterfly!' },
  shell: { tool: 'hand', items: { shell: 1 }, message: 'A seashell, just for you. Thanks, ocean!' },
};

const friendlyAdvice = [
  'The peach trees are extra generous today. Try giving one a little shake with empty hands!',
  'My favorite island rule? There’s no hurry. Though the fish do appreciate a fishing rod.',
  'A few flowers make anywhere feel like home. You have seeds in your pockets already!',
];

export function interactWith(state: GameState, entity: WorldEntity): InteractionResult {
  if (entity.kind === 'shop') return { state, message: 'Welcome in! Let’s see what island treasures you’ve found.', kind: 'shop', speaker: entity.name };
  if (entity.kind === 'home') return { state, message: 'Home, sweet island home. A little rest brings a brand-new day.', kind: 'home' };
  if (entity.kind === 'villager') {
    const known = state.met.includes(entity.name);
    const index = known ? state.met.indexOf(entity.name) : state.met.length;
    return {
      state: known ? state : { ...state, met: [...state.met, entity.name] },
      message: `${known ? 'Lovely to see you again!' : `Hi, I’m ${entity.name}! Welcome to the island.`} ${friendlyAdvice[index % friendlyAdvice.length]}`,
      kind: 'dialogue',
      speaker: entity.name,
    };
  }

  const resource = harvest[entity.kind];
  if (!resource) return { state, message: 'Take a moment. There’s a little wonder everywhere.', kind: 'info' };
  if (state.gathered.includes(entity.id)) return { state, message: 'All collected for today. Rest at home and come back tomorrow!', kind: 'info' };
  if (state.tool !== resource.tool) {
    return { state, message: `Select ${resource.tool === 'hand' ? 'empty hands' : `your ${TOOL_INFO[resource.tool].name.toLowerCase()}`} to ${entity.kind === 'tree' ? 'shake this tree' : entity.kind === 'rock' ? 'tap this rock' : entity.kind === 'fish' ? 'catch this fish' : entity.kind === 'butterfly' ? 'catch this butterfly' : 'pick up this seashell'}.`, kind: 'info' };
  }

  const inventory = { ...state.inventory };
  let count = 0;
  for (const id of itemIds) {
    const amount = resource.items[id] ?? 0;
    if (!Number.isSafeInteger(inventory[id] + amount)) return { state, message: 'That collection is full of treasures already!', kind: 'info' };
    inventory[id] += amount;
    count += amount;
  }
  const gathered = state.lifetime.gathered + count;
  const fish = state.lifetime.fish + (resource.items.fish ?? 0);
  if (!Number.isSafeInteger(gathered) || !Number.isSafeInteger(fish)) return { state, message: 'Your island journal is full of memories!', kind: 'info' };

  return {
    state: { ...state, inventory, gathered: [...state.gathered, entity.id], lifetime: { ...state.lifetime, gathered, fish } },
    message: resource.message,
    kind: 'success',
  };
}

export function sellItems(state: GameState): StateMessage {
  const saleable = itemIds.filter((id) => id !== 'flower');
  const count = saleable.reduce((sum, id) => sum + state.inventory[id], 0);
  if (count === 0) return { state, message: 'Your pockets have no treasures to sell yet. Try a peach tree or the beach!' };
  const value = saleable.reduce((sum, id) => sum + state.inventory[id] * ITEM_INFO[id].price, 0);
  const bells = state.bells + value;
  const sold = state.lifetime.sold + count;
  if (!Number.isSafeInteger(bells) || !Number.isSafeInteger(sold)) return { state, message: 'Your bell purse is full. Spend a few bells decorating first!' };
  const inventory = { ...state.inventory };
  for (const id of saleable) inventory[id] = 0;
  return {
    state: { ...state, bells, inventory, lifetime: { ...state.lifetime, sold } },
    message: `Sold ${count} ${count === 1 ? 'treasure' : 'treasures'} for ${value.toLocaleString('en-US')} bells. A lovely bit of business!`,
  };
}

export function placeDecoration(state: GameState, kind: DecorationKind, position: Position): StateMessage {
  if (!Object.hasOwn(DECORATION_INFO, kind) || !isPosition(position)) return { state, message: 'Choose a place on the island for your decoration.' };
  const decoration = DECORATION_INFO[kind];
  if (kind === 'flowers' && state.inventory.flower < 1) return { state, message: 'You’ve planted all your flower seeds. Your island is looking lovely!' };
  if (state.bells < decoration.price) return { state, message: `You need ${decoration.price.toLocaleString('en-US')} bells for this ${decoration.name.toLowerCase()}. Sell a few treasures at the shop!` };
  if (kind === 'flowers' && !Number.isSafeInteger(state.lifetime.planted + 1)) return { state, message: 'Your gardening journal is already overflowing!' };
  let number = state.decorations.length + 1;
  while (state.decorations.some((existing) => existing.id === `decoration-${number}`)) number += 1;
  return {
    state: {
      ...state,
      bells: state.bells - decoration.price,
      inventory: kind === 'flowers' ? { ...state.inventory, flower: state.inventory.flower - 1 } : state.inventory,
      decorations: [...state.decorations, { id: `decoration-${number}`, kind, x: position.x, z: position.z }],
      lifetime: kind === 'flowers' ? { ...state.lifetime, planted: state.lifetime.planted + 1 } : state.lifetime,
    },
    message: kind === 'flowers' ? 'A little room to bloom. Your flowers are planted!' : `${decoration.name} placed. The island feels a little more like you.`,
  };
}

export function claimTask(state: GameState, taskId: string): StateMessage {
  const task = TASKS.find((entry) => entry.id === taskId);
  if (!task) return { state, message: 'That island wish isn’t in your journal.' };
  if (state.completed.includes(task.id)) return { state, message: 'You’ve already collected this reward. Nicely done!' };
  if (taskProgress(state, task) < task.target) return { state, message: 'A little more exploring first. Your reward will be waiting!' };
  const bells = state.bells + task.reward;
  if (!Number.isSafeInteger(bells)) return { state, message: 'Your bell purse is full. Your reward will be here when you’re ready.' };
  return {
    state: { ...state, bells, completed: [...state.completed, task.id] },
    message: `Wish fulfilled! +${task.reward.toLocaleString('en-US')} bells for ${task.title.toLowerCase()}.`,
  };
}

export function nextDay(state: GameState): GameState {
  if (!Number.isSafeInteger(state.day + 1)) return state;
  return { ...state, day: state.day + 1, gathered: [], timeOfDay: 'day' };
}
