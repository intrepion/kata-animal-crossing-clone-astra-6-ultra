import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewGame, FURNITURE_INFO, STORAGE_KEY, VILLAGER_INFO } from './game/engine';
import { WORLD_ENTITIES } from './game/world';
import type { GameState, Location, Position, SceneOptions, SceneSnapshot, WorldEntity } from './game/types';
import App from './App';

type SceneEvent =
  | { action: 'sync'; location: Location; paused: boolean }
  | { action: 'visit'; location: Location; paused: boolean; id: string }
  | { action: 'waypoint'; location: Location; paused: boolean; point: Position };
interface SceneHarness {
  options: SceneOptions;
  snapshot: SceneSnapshot;
  player: Position;
  events: SceneEvent[];
}

const sceneHarness = vi.hoisted(() => ({ instances: [] as SceneHarness[] }));

// Exercise React and the real game engine through the renderer's public callbacks.
// No canvas, WebGL context, browser driver, or network is created by this double.
vi.mock('./game/scene', () => ({
  IslandScene: class {
    options: SceneOptions;
    snapshot: SceneSnapshot = { gathered: [], decorations: [], tool: 'hand', timeOfDay: 'day', paused: false, location: 'island' };
    player: Position;
    events: SceneEvent[] = [];

    constructor(_container: HTMLElement, options: SceneOptions) {
      this.options = options;
      this.player = options.initialPlayer ?? { x: 0, z: 5 };
      sceneHarness.instances.push(this);
      options.onReady?.();
    }
    sync(snapshot: SceneSnapshot) {
      if (snapshot.location === 'home' && this.snapshot.location !== 'home') this.player = { x: 0, z: 2.4 };
      this.snapshot = snapshot;
      this.events.push({ action: 'sync', location: snapshot.location ?? 'island', paused: snapshot.paused });
    }
    visit(id: string) {
      this.events.push({ action: 'visit', id, location: this.snapshot.location ?? 'island', paused: this.snapshot.paused });
    }
    setWaypoint(x: number, z: number) {
      this.events.push({ action: 'waypoint', point: { x, z }, location: this.snapshot.location ?? 'island', paused: this.snapshot.paused });
    }
    getPlayerPosition() { return this.player; }
    getFurniturePosition() { return { x: 2.5, z: 1.5 }; }
    getDecorationPosition() { return { x: 2, z: 4 }; }
    setPlayer(position: Position) { this.player = position; }
    setCamera() {}
    playAction() {}
    interact() {}
    destroy() {}
  },
}));

vi.mock('./audio', () => ({ chime: vi.fn(), setAmbient: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sceneHarness.instances.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const scene = () => {
  const instance = sceneHarness.instances.at(-1);
  if (!instance) throw new Error('App did not initialize the scene');
  return instance;
};
const entity = (id: string) => {
  const value = WORLD_ENTITIES.find((entry) => entry.id === id);
  if (!value) throw new Error(`Unknown world entity ${id}`);
  return value;
};
const interact = (target: string | WorldEntity) => act(() => scene().options.onInteract(typeof target === 'string' ? entity(target) : target));
const press = (key: string, repeat = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key, code: key === ' ' ? 'Space' : key === 'e' ? 'KeyE' : key, repeat });
const seed = (state: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const persisted = (): GameState => {
  act(() => vi.advanceTimersByTime(700));
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) throw new Error('The app did not save progress');
  return JSON.parse(saved) as GameState;
};

describe('island life through the app', () => {
  it('loads a legacy island into the new HUD and saves its migration without losing progress', () => {
    const state = createNewGame();
    state.name = 'Juniper';
    state.day = 7;
    state.bells = 5380;
    state.inventory.peach = 4;
    state.met = ['Maple'];
    state.completed = ['gather-five'];
    state.lifetime.gathered = 9;
    state.player = { x: -4, z: 3 };
    state.decorations = [{ id: 'garden-1', kind: 'flowers', x: 1, z: 4 }];
    const { friendships: _friendships, requests: _requests, furniture: _furniture, room: _room,
      homeLevel: _homeLevel, homeDebt: _homeDebt, ...legacy } = state;
    seed(legacy);
    render(<App />);

    expect(screen.getByRole('button', { name: 'Open island phone' })).toBeTruthy();
    expect(screen.getByText('Juniper Island')).toBeTruthy();
    expect(screen.getByText('5,380')).toBeTruthy();
    expect(scene().options.initialPlayer).toEqual(legacy.player);
    const saved = persisted();
    for (const [key, value] of Object.entries(legacy)) expect(saved[key as keyof GameState]).toEqual(value);
    expect(saved.room).toEqual(createNewGame().room);
    expect(saved.friendships.mabel).toBe(1);
    expect(saved.homeDebt).toBe(9800);
  });

  it('enters home through the world interaction and keeps indoor movement out of the outdoor save', () => {
    render(<App />);
    act(() => scene().options.onMove({ x: -4.8, z: -4.2 }));
    interact('home');

    expect(screen.getByText('Home sweet home')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go outside' })).toBeTruthy();
    expect(scene().snapshot.location).toBe('home');
    act(() => scene().options.onMove({ x: 1, z: 1 }));
    expect(persisted().player).toEqual({ x: -4.8, z: -4.2 });

    act(() => scene().options.onExitHome?.());
    expect(scene().snapshot.location).toBe('island');
    expect(screen.getByText('Clover Island')).toBeTruthy();
  });

  it.each(['landmark', 'point'] as const)('dispatches a %s map destination from home only after the island is active', (destination) => {
    render(<App />);
    interact('home');
    press('m');
    const mapPanel = screen.getByRole('dialog', { name: 'Clover Island' });
    expect(scene().snapshot.location).toBe('home');
    expect(scene().snapshot.paused).toBe(true);
    scene().events.length = 0;

    if (destination === 'landmark') {
      fireEvent.click(within(mapPanel).getByRole('button', { name: entity('shop').name }));
    } else {
      const map = within(mapPanel).getByRole('img', { name: /Island map/ });
      vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 176));
      fireEvent.click(map, { clientX: 110, clientY: 90.6 });
    }

    const routeIndex = scene().events.findIndex((event) => event.action === (destination === 'landmark' ? 'visit' : 'waypoint'));
    expect(routeIndex).toBeGreaterThan(0);
    expect(scene().events[routeIndex - 1]).toEqual({ action: 'sync', location: 'island', paused: false });
    const route = scene().events[routeIndex];
    expect(route.location).toBe('island');
    expect(route.paused).toBe(false);
    if (route.action === 'visit') expect(route.id).toBe('shop');
    if (route.action === 'waypoint') {
      expect(route.point.x).toBeCloseTo(2);
      expect(route.point.z).toBeCloseTo(1);
    }
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('puts purchased furniture in Pockets, takes it home, and places the owned copy', () => {
    render(<App />);
    interact('shop');
    fireEvent.click(screen.getByRole('button', { name: /Woven chair/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open pockets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Woven chair, 1' }));
    expect(screen.getByText('4 items')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take home' }));
    expect(scene().events).toContainEqual({ action: 'visit', id: 'home', location: 'island', paused: false });

    interact('home');
    fireEvent.click(screen.getByRole('button', { name: 'Open pockets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Woven chair, 1' }));
    fireEvent.click(screen.getByRole('button', { name: /^Place$/ }));
    const saved = persisted();
    expect(saved.furniture.chair).toBe(0);
    expect(saved.room.filter((item) => item.kind === 'chair')).toEqual([
      expect.objectContaining({ x: 2.5, z: 1.5, rotation: 0 }),
    ]);
    expect(saved.bells).toBe(createNewGame().bells - FURNITURE_INFO.chair.price);
  });

  it('lets keyboard players ask about and fulfill a neighbor request exactly once', () => {
    const state = createNewGame();
    state.inventory.peach = 3;
    seed(state);
    render(<App />);
    interact('mabel');

    press('e', true);
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
    press('e');
    expect(screen.getByRole('button', { name: /Need a hand with anything/ })).toBeTruthy();
    expect(screen.getByText(`${VILLAGER_INFO.mabel.greeting} ${VILLAGER_INFO.mabel.request.text}`)).toBeTruthy();
    press('e');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
    press('e');
    expect(screen.getByRole('button', { name: /I brought what you wanted/ })).toBeTruthy();
    press('e');
    press('e', true);
    const delivered = persisted();
    expect(delivered.inventory.peach).toBe(0);
    expect(delivered.bells).toBe(state.bells + VILLAGER_INFO.mabel.request.reward);
    expect(delivered.friendships.mabel).toBe(4);
    expect(delivered.requests.mabel).toEqual({ day: 1, delivered: true });

    press('Escape');
    interact('mabel');
    press('e');
    press('e');
    press('e');
    expect(screen.queryByRole('button', { name: /I brought what you wanted/ })).toBeNull();
    expect(persisted().bells).toBe(delivered.bells);
  });

  it('rests into a new day while preserving arranged furniture, belongings, and friendships', () => {
    const state = createNewGame();
    state.gathered = ['peach-1'];
    state.friendships.mabel = 4;
    state.requests.mabel = { day: 1, delivered: true };
    state.inventory.peach = 2;
    state.furniture.chair = 1;
    state.room = state.room.map((piece) => piece.kind === 'table' ? { ...piece, x: 1.5 } : piece);
    seed(state);
    render(<App />);
    interact('home');
    interact({ id: 'starter-bed', kind: 'bed', name: 'Rest in your bed', x: -2, z: -1 });
    fireEvent.click(screen.getByRole('button', { name: 'Rest until tomorrow' }));

    const saved = persisted();
    expect(saved.day).toBe(2);
    expect(saved.gathered).toEqual([]);
    expect(saved.room).toEqual(state.room);
    expect(saved.inventory).toEqual(state.inventory);
    expect(saved.furniture).toEqual(state.furniture);
    expect(saved.friendships).toEqual(state.friendships);
    expect(scene().snapshot.location).toBe('home');
  });

  it('refuses to move furniture onto the player and allows the move after the player steps aside', () => {
    render(<App />);
    interact('home');
    scene().player = { x: .5, z: -1 };
    act(() => scene().options.onFurnitureSelect?.('starter-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Move furniture left' }));
    expect(screen.getByRole('status').textContent).toMatch(/You’re standing there/);
    expect(persisted().room.find((piece) => piece.id === 'starter-table')?.x).toBe(1);

    scene().player = { x: 0, z: 2.4 };
    fireEvent.click(screen.getByRole('button', { name: 'Move furniture left' }));
    expect(persisted().room.find((piece) => piece.id === 'starter-table')?.x).toBe(.5);
  });
});
