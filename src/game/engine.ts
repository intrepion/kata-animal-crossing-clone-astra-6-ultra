import type { DecorationKind, FurnitureKind, FurniturePlacement, GameState, ItemId, Position, Tool, WorldEntity } from './types.ts';

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

export const FURNITURE_INFO: Record<FurnitureKind, { name: string; price: number; emoji: string; description: string; width: number; depth: number }> = {
  bed: { name: 'Cozy wooden bed', price: 1200, emoji: '🛏️', description: 'A quilt, a pillow, and permission to sleep in.', width: 1.6, depth: 2.4 },
  table: { name: 'Oak dining table', price: 650, emoji: '🪵', description: 'For a cup of tea and a little company.', width: 1.5, depth: 1 },
  chair: { name: 'Woven chair', price: 350, emoji: '🪑', description: 'Pull up a seat. There’s plenty of time.', width: .8, depth: .8 },
  plant: { name: 'Leafy houseplant', price: 280, emoji: '🪴', description: 'A little outdoors, happily indoors.', width: .7, depth: .7 },
  radio: { name: 'Pocket-sized radio', price: 480, emoji: '📻', description: 'Your island’s greatest hits, softly played.', width: .65, depth: .45 },
  lamp: { name: 'Warm reading lamp', price: 420, emoji: '💡', description: 'Make a little pool of evening light.', width: .65, depth: .65 },
  bookshelf: { name: 'Little library', price: 900, emoji: '📚', description: 'Stories for rainy days and long evenings.', width: 1.5, depth: .55 },
  rug: { name: 'Woven cottage rug', price: 550, emoji: '🧶', description: 'Soft underfoot. Furniture can sit on top.', width: 2.7, depth: 1.9 },
};

export const VILLAGER_INFO: Record<string, {
  name: string; animal: 'bear' | 'duck' | 'rabbit'; color: string; personality: string; greeting: string;
  request: { item: ItemId; count: number; reward: number; text: string; thanks: string };
}> = {
  mabel: {
    name: 'Maple', animal: 'bear', color: '#c9a77c', personality: 'A gentle baker who remembers the little things.',
    greeting: 'Oh, hello, honeybun! I’ve just put the kettle on. Have you found a favorite spot yet?',
    request: { item: 'peach', count: 3, reward: 450, text: 'I’m baking a peach tart for the neighbors. Could you bring me 3 peaches? I’ll save you the nicest slice, honeybun.', thanks: 'Three perfect peaches! The whole cottage is going to smell wonderful. Thank you, honeybun.' },
  },
  pip: {
    name: 'Pip', animal: 'duck', color: '#e8c869', personality: 'An enthusiastic explorer with very grand fishing stories.',
    greeting: 'Hey, skipper! I was just planning my next great expedition. As far as the other side of the bridge!',
    request: { item: 'fish', count: 1, reward: 380, text: 'I’m trying to sketch a real river fish for my adventure journal. Bring me one? My drawings keep looking like potatoes, skipper.', thanks: 'Now THAT is a fish! Just look at those fins. You’ve saved my reputation as an explorer, skipper!' },
  },
  clover: {
    name: 'Clover', animal: 'rabbit', color: '#efded1', personality: 'A dreamy gardener who finds inspiration in tiny wonders.',
    greeting: 'Hi, petal! I was following a butterfly and forgot where I was going. It was a lovely detour.',
    request: { item: 'butterfly', count: 1, reward: 320, text: 'Could you catch a butterfly for me, petal? I want to match its colors for my new flower garden. I’ll let it flutter away afterward.', thanks: 'Oh, those colors! I know exactly which flowers to plant now. Off you go, little butterfly. Thank you, petal.' },
  },
};

const neighborSmallTalk: Record<string, string[]> = {
  mabel: ['The secret to a good tart is patience. The secret to a good day might be the same thing, honeybun.', 'I left a little room by my window for a reading chair. A home grows around the things you love.', 'I tried a new biscuit recipe this morning. Well, three recipes. Research can be delicious, honeybun.'],
  pip: ['Today’s expedition: the beach! Tomorrow’s expedition: also the beach, but with a snack.', 'I saw a fish THIS big, skipper. All right, perhaps a little smaller. You should have seen it!', 'A good explorer always knows the way home. Mine is usually whichever way smells like Maple’s baking.'],
  clover: ['The flowers have been leaning toward the sun all morning. I think they have the right idea, petal.', 'I’m collecting beautiful moments. That cloud. A new leaf. Getting to see you today.', 'You know, petal, moving one little plant can make a whole room feel new. Homes can grow slowly, just like gardens.'],
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
    friendships: { mabel: 0, pip: 0, clover: 0 },
    requests: {},
    furniture: { bed: 0, table: 0, chair: 0, plant: 0, radio: 0, lamp: 0, bookshelf: 0, rug: 0 },
    room: [
      { id: 'starter-bed', kind: 'bed', x: -2, z: -1, rotation: 0 },
      { id: 'starter-table', kind: 'table', x: 1, z: -1, rotation: 0 },
      { id: 'starter-plant', kind: 'plant', x: 2.9, z: -2.5, rotation: 0 },
      { id: 'starter-rug', kind: 'rug', x: 0, z: .6, rotation: 0 },
    ],
    homeLevel: 0,
    homeDebt: 9800,
  };
}

export const INITIAL_STATE: GameState = createNewGame();

const itemIds = Object.keys(ITEM_INFO) as ItemId[];
const tools = Object.keys(TOOL_INFO);
const decorationKinds = Object.keys(DECORATION_INFO);
const furnitureKinds = Object.keys(FURNITURE_INFO) as FurnitureKind[];
const taskIds = new Set(TASKS.map((task) => task.id));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isLabel = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const isPosition = (value: unknown): value is Position => isRecord(value)
  && typeof value.x === 'number' && Number.isFinite(value.x)
  && typeof value.z === 'number' && Number.isFinite(value.z);
const isUniqueStringArray = (value: unknown): value is string[] => Array.isArray(value)
  && value.every(isLabel) && new Set(value).size === value.length;
const isRotation = (value: unknown): value is number => isCount(value) && value < 4;

function furnitureSize(kind: FurnitureKind, rotation: number) {
  const info = FURNITURE_INFO[kind];
  return rotation % 2 === 0 ? { width: info.width, depth: info.depth } : { width: info.depth, depth: info.width };
}

function furnitureFitsRoom(homeLevel: number, kind: FurnitureKind, position: Position, rotation: number) {
  const { width, depth } = furnitureSize(kind, rotation);
  return Math.abs(position.x) + width / 2 <= (homeLevel > 0 ? 5 : 4) - .12
    && Math.abs(position.z) + depth / 2 <= (homeLevel > 0 ? 4.5 : 3.5) - .12;
}

function migrateSave(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const defaults = createNewGame();
  const migrated = { ...value };
  for (const field of ['friendships', 'requests', 'furniture', 'room', 'homeLevel', 'homeDebt'] as const) {
    if (!Object.hasOwn(migrated, field)) migrated[field] = defaults[field];
  }
  if (!Object.hasOwn(value, 'homeDebt') && value.homeLevel === 1) migrated.homeDebt = 0;
  if (!Object.hasOwn(value, 'homeLevel') && value.homeDebt === 0) migrated.homeLevel = 1;
  if (!Object.hasOwn(value, 'friendships') && Array.isArray(value.met)) {
    const met = value.met;
    migrated.friendships = Object.fromEntries(Object.entries(VILLAGER_INFO).map(([id, info]) => [id, met.includes(info.name) ? 1 : 0]));
  }
  return migrated;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.version !== 1 || !isLabel(value.name)
    || !isCount(value.bells) || !isCount(value.day) || value.day < 1
    || !isRecord(value.inventory) || !isRecord(value.lifetime)
    || !isUniqueStringArray(value.gathered) || !isUniqueStringArray(value.met)
    || !isUniqueStringArray(value.completed) || !value.completed.every((id) => taskIds.has(id))
    || !Array.isArray(value.decorations) || !isPosition(value.player)
    || typeof value.tool !== 'string' || !tools.includes(value.tool)
    || !['day', 'sunset', 'night'].includes(value.timeOfDay as string)
    || typeof value.sound !== 'boolean'
    || !isRecord(value.friendships) || !isRecord(value.requests) || !isRecord(value.furniture)
    || !Array.isArray(value.room) || !isCount(value.homeLevel) || value.homeLevel > 1
    || !isCount(value.homeDebt) || (value.homeLevel === 1 && value.homeDebt !== 0)
    || (value.homeLevel === 0 && value.homeDebt === 0)) return false;

  const inventory = value.inventory;
  const lifetime = value.lifetime;
  if (!itemIds.every((id) => isCount(inventory[id]))
    || !['gathered', 'fish', 'sold', 'planted'].every((metric) => isCount(lifetime[metric]))) return false;

  const furniture = value.furniture;
  const day = value.day;
  if (!furnitureKinds.every((id) => isCount(furniture[id]))
    || !Object.entries(value.friendships).every(([id, points]) => Object.hasOwn(VILLAGER_INFO, id) && isCount(points))
    || !Object.entries(value.requests).every(([id, request]) => Object.hasOwn(VILLAGER_INFO, id) && isRecord(request)
      && isCount(request.day) && request.day >= 1 && request.day <= day && typeof request.delivered === 'boolean')) return false;

  const roomIds = new Set<string>();
  if (!value.room.every((placed: unknown) => {
    if (!isRecord(placed) || !isLabel(placed.id) || roomIds.has(placed.id)
      || typeof placed.kind !== 'string' || !Object.hasOwn(FURNITURE_INFO, placed.kind)
      || !isPosition(placed) || !isRotation(placed.rotation)
      || !furnitureFitsRoom(value.homeLevel as number, placed.kind as FurnitureKind, placed, placed.rotation)) return false;
    roomIds.add(placed.id);
    return true;
  })) return false;

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
    const parsed = migrateSave(JSON.parse(saved));
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

export function getVillagerDialogue(state: GameState, id: string): {
  speaker: string; message: string; friendship: number;
  request?: { item: ItemId; count: number; reward: number; text: string; delivered: boolean; canDeliver: boolean };
} {
  if (!Object.hasOwn(VILLAGER_INFO, id)) return { speaker: 'Neighbor', message: 'A lovely day to see a friendly face!', friendship: 0 };
  const villager = VILLAGER_INFO[id];
  const friendship = state.friendships[id] ?? 0;
  const daily = state.requests[id];
  const delivered = daily?.day === state.day && daily.delivered;
  const known = state.met.includes(villager.name);
  const chatter = neighborSmallTalk[id][(state.day - 1) % neighborSmallTalk[id].length];
  const welcome = !known ? villager.greeting : friendship >= 8 ? `There’s my favorite neighbor! ${chatter}` : chatter;
  return {
    speaker: villager.name,
    message: `${welcome} ${delivered ? villager.request.thanks : villager.request.text}`,
    friendship,
    request: {
      item: villager.request.item,
      count: villager.request.count,
      reward: villager.request.reward,
      text: villager.request.text,
      delivered,
      canDeliver: daily?.day === state.day && !delivered && state.inventory[villager.request.item] >= villager.request.count,
    },
  };
}

export function fulfillRequest(state: GameState, id: string): StateMessage {
  if (!Object.hasOwn(VILLAGER_INFO, id)) return { state, message: 'That neighbor isn’t waiting for a delivery.' };
  const villager = VILLAGER_INFO[id];
  const daily = state.requests[id];
  if (daily?.day !== state.day) return { state, message: `Say hello to ${villager.name} to hear what they’re looking for today.` };
  if (daily.delivered) return { state, message: `${villager.name} already received your gift today. Come say hello again tomorrow!` };
  const { item, count, reward, thanks } = villager.request;
  if (state.inventory[item] < count) return { state, message: `${villager.name} is still looking for ${count} ${ITEM_INFO[item].name.toLowerCase()}${count > 1 ? 's' : ''}. You can bring them when you’re ready.` };
  const bells = state.bells + reward;
  const friendship = (state.friendships[id] ?? 0) + 3;
  if (!Number.isSafeInteger(bells) || !Number.isSafeInteger(friendship)) return { state, message: 'Your bell purse is full. Your neighbor can wait a little longer.' };
  return {
    state: {
      ...state,
      bells,
      inventory: { ...state.inventory, [item]: state.inventory[item] - count },
      friendships: { ...state.friendships, [id]: friendship },
      requests: { ...state.requests, [id]: { day: state.day, delivered: true } },
    },
    message: `${thanks} +${reward} bells. Your friendship with ${villager.name} grew!`,
  };
}

export function interactWith(state: GameState, entity: WorldEntity): InteractionResult {
  if (entity.kind === 'shop') return { state, message: 'Welcome in! Let’s see what island treasures you’ve found.', kind: 'shop', speaker: entity.name };
  if (entity.kind === 'home') return { state, message: 'Home, sweet island home. A little rest brings a brand-new day.', kind: 'home' };
  if (entity.kind === 'villager') {
    if (Object.hasOwn(VILLAGER_INFO, entity.id)) {
      const villager = VILLAGER_INFO[entity.id];
      const dialogue = getVillagerDialogue(state, entity.id);
      const known = state.met.includes(villager.name);
      const greetedToday = state.requests[entity.id]?.day === state.day;
      const next = known && greetedToday ? state : {
        ...state,
        met: known ? state.met : [...state.met, villager.name],
        friendships: greetedToday ? state.friendships : { ...state.friendships, [entity.id]: Math.min(Number.MAX_SAFE_INTEGER, (state.friendships[entity.id] ?? 0) + 1) },
        requests: greetedToday ? state.requests : { ...state.requests, [entity.id]: { day: state.day, delivered: false } },
      };
      return { state: next, message: dialogue.message, kind: 'dialogue', speaker: villager.name };
    }
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

export function buyFurniture(state: GameState, kind: FurnitureKind): StateMessage {
  if (!Object.hasOwn(FURNITURE_INFO, kind)) return { state, message: 'That piece isn’t in the market catalog.' };
  const item = FURNITURE_INFO[kind];
  if (state.bells < item.price) return { state, message: `You need ${item.price.toLocaleString('en-US')} bells for the ${item.name.toLowerCase()}.` };
  if (!Number.isSafeInteger(state.furniture[kind] + 1)) return { state, message: 'Your furniture storage is full of lovely things already.' };
  return {
    state: { ...state, bells: state.bells - item.price, furniture: { ...state.furniture, [kind]: state.furniture[kind] + 1 } },
    message: `A ${item.name.toLowerCase()}, just for you! It’s in your pockets, ready to place at home.`,
  };
}

function placementProblem(state: GameState, kind: FurnitureKind, position: Position, rotation: number, movingId?: string): string | null {
  if (!Object.hasOwn(FURNITURE_INFO, kind) || !isPosition(position) || !isRotation(rotation)) return 'Choose a spot inside your home and a quarter-turn rotation.';
  if (!furnitureFitsRoom(state.homeLevel, kind, position, rotation)) return 'That piece would reach through the wall. Try a spot farther inside the room.';
  const size = furnitureSize(kind, rotation);
  if (kind !== 'rug' && Math.abs(position.x) < size.width / 2 + .65
    && position.z + size.depth / 2 > (state.homeLevel > 0 ? 4.5 : 3.5) - 1.4) {
    return 'Leave a little room by the doorway so you can come and go.';
  }
  for (const existing of state.room) {
    if (existing.id === movingId || kind === 'rug' || existing.kind === 'rug') continue;
    const otherSize = furnitureSize(existing.kind, existing.rotation);
    if (Math.abs(position.x - existing.x) < (size.width + otherSize.width) / 2 + .1
      && Math.abs(position.z - existing.z) < (size.depth + otherSize.depth) / 2 + .1) {
      return `There’s a ${FURNITURE_INFO[existing.kind].name.toLowerCase()} in the way. Give each piece a little breathing room.`;
    }
  }
  return null;
}

export function placeFurniture(state: GameState, kind: FurnitureKind, position: Position, rotation = 0): StateMessage {
  if (!Object.hasOwn(FURNITURE_INFO, kind)) return { state, message: 'Choose a piece of furniture from your pockets.' };
  if (state.furniture[kind] < 1) return { state, message: `You don’t have a ${FURNITURE_INFO[kind].name.toLowerCase()} in your pockets. Find one at the market.` };
  const problem = placementProblem(state, kind, position, rotation);
  if (problem) return { state, message: problem };
  let number = state.room.length + 1;
  while (state.room.some((existing) => existing.id === `furniture-${number}`)) number += 1;
  const placed: FurniturePlacement = { id: `furniture-${number}`, kind, x: position.x, z: position.z, rotation };
  return {
    state: { ...state, furniture: { ...state.furniture, [kind]: state.furniture[kind] - 1 }, room: [...state.room, placed] },
    message: `${FURNITURE_INFO[kind].name} placed. That looks like home!`,
  };
}

export function moveFurniture(state: GameState, id: string, position: Position, rotation?: number): StateMessage {
  const placed = state.room.find((item) => item.id === id);
  if (!placed) return { state, message: 'That piece is no longer in the room.' };
  const nextRotation = rotation ?? placed.rotation;
  const problem = placementProblem(state, placed.kind, position, nextRotation, id);
  if (problem) return { state, message: problem };
  if (placed.x === position.x && placed.z === position.z && placed.rotation === nextRotation) return { state, message: 'It already looks right at home there.' };
  return {
    state: { ...state, room: state.room.map((item) => item.id === id ? { ...item, x: position.x, z: position.z, rotation: nextRotation } : item) },
    message: `${FURNITURE_INFO[placed.kind].name} moved. A fresh little perspective.`,
  };
}

export function returnFurniture(state: GameState, id: string): StateMessage {
  const placed = state.room.find((item) => item.id === id);
  if (!placed) return { state, message: 'That piece is already packed away.' };
  if (!Number.isSafeInteger(state.furniture[placed.kind] + 1)) return { state, message: 'Your furniture storage is full of lovely things already.' };
  return {
    state: { ...state, furniture: { ...state.furniture, [placed.kind]: state.furniture[placed.kind] + 1 }, room: state.room.filter((item) => item.id !== id) },
    message: `${FURNITURE_INFO[placed.kind].name} tucked into your pockets. You can put it back anytime.`,
  };
}

export function payHomeDebt(state: GameState, amount: number): StateMessage {
  if (state.homeDebt === 0) return { state, message: 'Your cottage is paid for, every cozy corner of it!' };
  if (!isCount(amount) || amount === 0) return { state, message: 'Choose a whole number of bells to put toward your home.' };
  const payment = Math.min(amount, state.homeDebt);
  if (payment > state.bells) return { state, message: 'You don’t have that many bells just yet. Every little contribution counts.' };
  const homeDebt = state.homeDebt - payment;
  return {
    state: { ...state, bells: state.bells - payment, homeDebt, homeLevel: homeDebt === 0 ? 1 : state.homeLevel },
    message: homeDebt === 0
      ? 'Your home is all paid off! We’ve opened up the room—more space for your little life.'
      : `${payment.toLocaleString('en-US')} bells closer to a bigger home. ${homeDebt.toLocaleString('en-US')} bells left, and no hurry.`,
  };
}

export function nextDay(state: GameState): GameState {
  if (!Number.isSafeInteger(state.day + 1)) return state;
  return { ...state, day: state.day + 1, gathered: [], timeOfDay: 'day' };
}
