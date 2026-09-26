import type { Position, WorldEntity } from './types';

export const PLAYER_START: Position = { x: 0.2, z: 4.2 };

export const WORLD_ENTITIES: WorldEntity[] = [
  { id: 'home', kind: 'home', name: 'Your little cottage', x: -5.1, z: -6.9 },
  { id: 'shop', kind: 'shop', name: 'Fern & Fig Market', x: -9.2, z: 0.5 },
  { id: 'mabel', kind: 'villager', name: 'Maple', x: 2.8, z: 2.4, color: '#c9a77c' },
  { id: 'pip', kind: 'villager', name: 'Pip', x: 9.5, z: -5.5, color: '#e8c869' },
  { id: 'clover', kind: 'villager', name: 'Clover', x: -4.8, z: 3.5, color: '#efded1' },
  { id: 'peach-1', kind: 'tree', name: 'Peach tree', x: -12.6, z: -5.8 },
  { id: 'peach-2', kind: 'tree', name: 'Peach tree', x: -12.7, z: 1.1 },
  { id: 'peach-3', kind: 'tree', name: 'Peach tree', x: -9.7, z: 7.6 },
  { id: 'peach-4', kind: 'tree', name: 'Peach tree', x: -2, z: -10.7 },
  { id: 'peach-5', kind: 'tree', name: 'Peach tree', x: 3.5, z: -10.8 },
  { id: 'peach-6', kind: 'tree', name: 'Peach tree', x: 11.7, z: -8 },
  { id: 'peach-7', kind: 'tree', name: 'Peach tree', x: 14, z: -1.9 },
  { id: 'peach-8', kind: 'tree', name: 'Peach tree', x: 10.8, z: 7.2 },
  { id: 'peach-9', kind: 'tree', name: 'Peach tree', x: 4.5, z: 9.4 },
  { id: 'rock-1', kind: 'rock', name: 'Mossy rock', x: -13.4, z: 4.3 },
  { id: 'rock-2', kind: 'rock', name: 'River stone', x: 9.1, z: -9.5 },
  { id: 'rock-3', kind: 'rock', name: 'Mossy rock', x: 12.8, z: 5.6 },
  { id: 'shell-1', kind: 'shell', name: 'Scallop shell', x: -6.5, z: 11.5 },
  { id: 'shell-2', kind: 'shell', name: 'Scallop shell', x: -1.8, z: 12.5 },
  { id: 'shell-3', kind: 'shell', name: 'Scallop shell', x: 7.6, z: 11 },
  { id: 'shell-4', kind: 'shell', name: 'Scallop shell', x: -15.5, z: -1.8 },
  { id: 'fish-1', kind: 'fish', name: 'River fish', x: 7.9, z: -0.7 },
  { id: 'fish-2', kind: 'fish', name: 'River fish', x: 4.7, z: -7.7 },
  { id: 'fish-3', kind: 'fish', name: 'River fish', x: 13.1, z: 2.7 },
  { id: 'butterfly-1', kind: 'butterfly', name: 'Sunny butterfly', x: -1.6, z: -1.8 },
  { id: 'butterfly-2', kind: 'butterfly', name: 'Blue butterfly', x: 6.3, z: 5.8 },
  { id: 'butterfly-3', kind: 'butterfly', name: 'Sunny butterfly', x: -7.5, z: 5.5 },
];
