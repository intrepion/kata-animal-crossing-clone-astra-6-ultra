export type Tool = 'hand' | 'net' | 'rod' | 'shovel';
export type ItemId = 'peach' | 'wood' | 'stone' | 'shell' | 'fish' | 'butterfly' | 'flower';
export type EntityKind = 'tree' | 'rock' | 'fish' | 'shell' | 'butterfly' | 'villager' | 'home' | 'shop';
export type DecorationKind = 'flowers' | 'bench' | 'lantern';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export interface Position { x: number; z: number }
export interface WorldEntity { id: string; kind: EntityKind; x: number; z: number; name: string; color?: string }
export interface Decoration extends Position { id: string; kind: DecorationKind }
export interface GameState {
  version: 1;
  name: string;
  bells: number;
  day: number;
  inventory: Record<ItemId, number>;
  gathered: string[];
  met: string[];
  decorations: Decoration[];
  completed: string[];
  lifetime: { gathered: number; fish: number; sold: number; planted: number };
  player: Position;
  tool: Tool;
  timeOfDay: TimeOfDay;
  sound: boolean;
}
export interface SceneSnapshot {
  gathered: string[];
  decorations: Decoration[];
  tool: Tool;
  timeOfDay: TimeOfDay;
  paused: boolean;
}
export interface SceneOptions {
  initialPlayer?: Position;
  onNear: (entity: WorldEntity | null) => void;
  onInteract: (entity: WorldEntity) => void;
  onMove: (position: Position) => void;
  onReady?: () => void;
}
