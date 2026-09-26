export type Tool = "hand" | "net" | "rod" | "shovel";
export type ItemId =
  | "peach"
  | "wood"
  | "stone"
  | "shell"
  | "fish"
  | "butterfly"
  | "flower";
export type EntityKind =
  | "tree"
  | "rock"
  | "fish"
  | "shell"
  | "butterfly"
  | "villager"
  | "home"
  | "shop"
  | "bed"
  | "exit";
export type DecorationKind = "flowers" | "bench" | "lantern";
export type TimeOfDay = "day" | "sunset" | "night";
export type Location = "island" | "home";
export type FurnitureKind =
  | "bed"
  | "table"
  | "chair"
  | "plant"
  | "radio"
  | "lamp"
  | "bookshelf"
  | "rug";
export interface Position {
  x: number;
  z: number;
}
export interface WorldEntity {
  id: string;
  kind: EntityKind;
  x: number;
  z: number;
  name: string;
  color?: string;
}
export interface Decoration extends Position {
  id: string;
  kind: DecorationKind;
}
export interface FurniturePlacement extends Position {
  id: string;
  kind: FurnitureKind;
  rotation: number;
}
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
  friendships: Record<string, number>;
  requests: Record<string, { day: number; delivered: boolean }>;
  furniture: Record<FurnitureKind, number>;
  room: FurniturePlacement[];
  homeLevel: number;
  homeDebt: number;
}
export interface SceneSnapshot {
  gathered: string[];
  decorations: Decoration[];
  tool: Tool;
  timeOfDay: TimeOfDay;
  paused: boolean;
  location?: Location;
  room?: FurniturePlacement[];
  homeLevel?: number;
}
export interface SceneOptions {
  initialPlayer?: Position;
  onNear: (entity: WorldEntity | null) => void;
  onInteract: (entity: WorldEntity) => void;
  onMove: (position: Position) => void;
  onReady?: () => void;
  onExitHome?: () => void;
  onFurnitureSelect?: (id: string) => void;
}
