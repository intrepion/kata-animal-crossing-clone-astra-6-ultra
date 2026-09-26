import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FurnitureKind, FurniturePlacement, Position } from './types';

const FLOOR = .43;
const FOOTPRINT: Record<FurnitureKind, [number, number]> = {
  bed: [1.6, 2.4], table: [1.5, 1], chair: [.8, .8], plant: [.7, .7],
  radio: [.65, .45], lamp: [.65, .65], bookshelf: [1.5, .55], rug: [2.7, 1.9],
};
const PALETTE = {
  wall: 0xb9cbb5, stripe: 0xc6d6bf, cream: 0xfff4df, trim: 0xeee7d1,
  oak: 0xcda171, oakLight: 0xe3bc87, oakDark: 0x9c704d, sage: 0x80a58d,
  teal: 0x64958b, ink: 0x455e53, brass: 0xc3a26a, coral: 0xe7a18d,
};

/** An enterable, dollhouse-style room. All dimensions are shared with world-space movement. */
export class HomeInterior {
  readonly group = new THREE.Group();
  private readonly architecture = new THREE.Group();
  private readonly furnishings = new THREE.Group();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private room: FurniturePlacement[] = [];
  private level = -1;
  private roomSignature = '';
  private halfWidth = 4;
  private halfDepth = 3.5;

  constructor() {
    this.group.name = 'Home interior';
    this.group.add(this.architecture, this.furnishings);
    this.sync([], 0);
  }

  sync(room: FurniturePlacement[], level: number): void {
    const nextLevel = level > 0 ? 1 : 0;
    if (this.level !== nextLevel) {
      this.clearGeometry(this.architecture);
      this.level = nextLevel;
      this.halfWidth = nextLevel ? 5 : 4;
      this.halfDepth = nextLevel ? 4.5 : 3.5;
      this.buildRoom();
    }
    const signature = JSON.stringify(room);
    if (signature === this.roomSignature) return;
    this.roomSignature = signature;
    this.room = room.map(piece => ({ ...piece }));
    this.clearGeometry(this.furnishings);
    for (const piece of room) {
      const furniture = new THREE.Group();
      furniture.name = `${piece.kind} (${piece.id})`;
      furniture.position.set(piece.x, FLOOR, piece.z);
      furniture.rotation.y = piece.rotation * Math.PI / 2;
      this.buildFurniture(furniture, piece.kind);
      furniture.traverse(object => {
        object.userData.furnitureId = piece.id;
        object.userData.furnitureKind = piece.kind;
      });
      this.furnishings.add(furniture);
    }
  }

  collides(x: number, z: number): boolean {
    const radius = .22;
    if (Math.abs(x) > this.halfWidth - radius || Math.abs(z) > this.halfDepth - radius) return true;
    return this.room.some(piece => {
      if (piece.kind === 'rug') return false;
      const [width, depth] = this.footprint(piece.kind, piece.rotation);
      return Math.abs(x - piece.x) < width / 2 + radius && Math.abs(z - piece.z) < depth / 2 + radius;
    });
  }

  getPlacement(kind: FurnitureKind, player: Position): Position | null {
    const [width, depth] = FOOTPRINT[kind];
    const candidates: (Position & { score: number })[] = [];
    for (let x = -this.halfWidth + .5; x < this.halfWidth; x += .5) {
      for (let z = -this.halfDepth + .5; z < this.halfDepth; z += .5) {
        if (Math.abs(x) + width / 2 > this.halfWidth - .12 || Math.abs(z) + depth / 2 > this.halfDepth - .12) continue;
        // Preserve the front doorway and enough space for the player to step away after placing.
        if (kind !== 'rug' && Math.abs(x) < width / 2 + .65 && z + depth / 2 > this.halfDepth - 1.4) continue;
        if (kind !== 'rug' && Math.abs(x - player.x) < width / 2 + .4 && Math.abs(z - player.z) < depth / 2 + .4) continue;
        const overlap = this.room.some(piece => {
          if (piece.kind === 'rug' || kind === 'rug') return false;
          const [otherWidth, otherDepth] = this.footprint(piece.kind, piece.rotation);
          return Math.abs(x - piece.x) < (width + otherWidth) / 2 + .1 && Math.abs(z - piece.z) < (depth + otherDepth) / 2 + .1;
        });
        if (!overlap) candidates.push({ x, z, score: Math.hypot(x - player.x, z - player.z) + (z > player.z ? .15 : 0) });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates.length ? { x: candidates[0].x, z: candidates[0].z } : null;
  }

  dispose(): void {
    this.clearGeometry(this.architecture);
    this.clearGeometry(this.furnishings);
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
    this.group.removeFromParent();
  }

  private footprint(kind: FurnitureKind, rotation = 0): [number, number] {
    const [width, depth] = FOOTPRINT[kind];
    return Math.abs(rotation) % 2 === 1 ? [depth, width] : [width, depth];
  }

  private clearGeometry(group: THREE.Group) {
    group.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    group.clear();
  }

  private material(color: THREE.ColorRepresentation, glow = 0, opacity = 1) {
    const key = `${color}|${glow}|${opacity}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0,
        emissive: glow ? color : 0x000000, emissiveIntensity: glow,
        transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
      });
      this.materials.set(key, mat);
    }
    return mat;
  }

  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, glow = 0) {
    const result = new THREE.Mesh(geometry, this.material(color, glow));
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }

  private box(parent: THREE.Object3D, width: number, height: number, depth: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, radius = .025) {
    const radiusSafe = Math.min(radius, width / 3, height / 3, depth / 3);
    return this.mesh(parent, radiusSafe > 0 ? new RoundedBoxGeometry(width, height, depth, 2, radiusSafe) : new THREE.BoxGeometry(width, height, depth), color, x, y, z);
  }

  private cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) {
    return this.mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 28), color, x, y, z);
  }

  private ball(parent: THREE.Object3D, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) {
    const sphere = this.mesh(parent, new THREE.SphereGeometry(1, 20, 14), color, x, y, z);
    sphere.scale.set(sx, sy, sz);
    return sphere;
  }

  private stick(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.ColorRepresentation) {
    const direction = b.clone().sub(a);
    const rod = this.cylinder(parent, radius, radius, direction.length(), color);
    rod.position.copy(a.clone().add(b).multiplyScalar(.5));
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return rod;
  }

  private buildRoom() {
    const w = this.halfWidth, d = this.halfDepth, room = this.architecture;
    this.box(room, w * 2 + .25, .38, d * 2 + .25, PALETTE.oakDark, 0, FLOOR - .21, 0, .08);
    this.box(room, w * 2, .06, d * 2, 0xc69a67, 0, FLOOR - .03, 0, 0);
    // Staggered oak boards with fine, warm seams and occasional restrained wood grain.
    const rowCount = Math.round(d * 2 / .44);
    const rowDepth = d * 2 / rowCount;
    const tones = [0xd9b27d, 0xdfbb86, 0xd3a875, 0xe1bb86, 0xdbb17c];
    for (let row = 0; row < rowCount; row++) {
      const z = -d + (row + .5) * rowDepth;
      const offset = row % 3 * .7;
      for (let i = -1; i < Math.ceil(w * 2 / 2.1) + 1; i++) {
        const start = Math.max(-w, -w + i * 2.1 + offset);
        const end = Math.min(w, -w + (i + 1) * 2.1 + offset);
        if (end - start < .03) continue;
        const tone = tones[(row * 7 + i + 10) % tones.length];
        this.box(room, end - start - .012, .035, rowDepth - .012, tone, (start + end) / 2, FLOOR - .014, z, .004);
        if ((row + i) % 3 === 0 && end - start > .6) {
          this.box(room, (end - start) * .45, .003, .007, 0xcaa373, (start + end) / 2 + .06, FLOOR + .005, z - .1, 0).castShadow = false;
        }
      }
    }
    const wallHeight = 3.35;
    this.box(room, w * 2 + .3, wallHeight, .16, PALETTE.wall, 0, FLOOR + wallHeight / 2, -d - .08, 0);
    for (const sign of [-1, 1]) {
      this.box(room, .16, wallHeight, d * 2 + .16, PALETTE.wall, sign * (w + .08), FLOOR + wallHeight / 2, 0, 0);
    }
    for (let x = -w + .14; x < w; x += .29) {
      this.box(room, .055, wallHeight - .52, .009, PALETTE.stripe, x, FLOOR + wallHeight / 2 + .12, -d + .007, 0);
    }
    for (const sign of [-1, 1]) {
      for (let z = -d + .14; z < d; z += .29) this.box(room, .009, wallHeight - .52, .055, PALETTE.stripe, sign * (w - .007), FLOOR + wallHeight / 2 + .12, z, 0);
    }
    // Beadboard, baseboards, and a broad pale crown frame the wallpaper.
    this.box(room, w * 2, .58, .036, 0xe4e5cf, 0, FLOOR + .29, -d + .025, 0);
    for (let x = -w + .18; x < w; x += .24) this.box(room, .009, .5, .014, 0xc9d0ba, x, FLOOR + .29, -d + .047, 0);
    for (const y of [.065, .59, wallHeight - .1]) {
      const height = y > 3 ? .18 : y > .5 ? .075 : .13;
      this.box(room, w * 2 + .05, height, .12, PALETTE.trim, 0, FLOOR + y, -d + .065, .012);
      for (const sign of [-1, 1]) this.box(room, .12, height, d * 2, PALETTE.trim, sign * (w - .055), FLOOR + y, 0, .012);
    }
    for (const sign of [-1, 1]) {
      this.box(room, .04, .58, d * 2, 0xe4e5cf, sign * (w - .025), FLOOR + .29, 0, 0);
      this.box(room, .13, wallHeight, .16, PALETTE.trim, sign * (w - .035), FLOOR + wallHeight / 2, d - .025, .01);
      this.box(room, .12, wallHeight, .12, PALETTE.trim, sign * (w - .035), FLOOR + wallHeight / 2, -d + .035, .01);
    }
    // Open-front threshold makes the way outside clear while keeping the room visible.
    this.box(room, 1.7, .025, .38, 0xf0d2a5, 0, FLOOR + .004, d - .2, .015);
    this.box(room, 1.24, .018, .61, PALETTE.sage, 0, FLOOR + .019, d - .59, .025);
    for (let i = -4; i <= 4; i++) this.box(room, .016, .004, .48, 0xa4bfa3, i * .12, FLOOR + .03, d - .59, 0).castShadow = false;

    const backWindow = this.window();
    backWindow.position.set(w * .46, FLOOR + 1.86, -d + .105);
    room.add(backWindow);
    const leftWindow = this.window();
    leftWindow.position.set(-w + .105, FLOOR + 1.86, -.8);
    leftWindow.rotation.y = Math.PI / 2;
    room.add(leftWindow);
    this.wallArt(room, -w * .53, FLOOR + 2.14, -d + .11);
    // A small wall clock gives the quiet room a familiar focal point.
    const clock = new THREE.Group();
    clock.position.set(0, FLOOR + 2.72, -d + .1);
    const clockRim = this.cylinder(clock, .24, .24, .06, PALETTE.oakDark);
    clockRim.rotation.x = Math.PI / 2;
    const clockFace = this.cylinder(clock, .21, .21, .063, PALETTE.cream, 0, 0, .009);
    clockFace.rotation.x = Math.PI / 2;
    this.box(clock, .014, .13, .015, PALETTE.ink, 0, .052, .048, .002);
    this.box(clock, .09, .014, .015, PALETTE.ink, .04, 0, .048, .002);
    this.ball(clock, .018, .018, .012, PALETTE.brass, 0, 0, .06);
    room.add(clock);

    // Warm, translucent sunbeams are laid onto the floor as soft geometry.
    for (let i = 0; i < 2; i++) {
      const light = this.box(room, .56, .006, 1.7, 0xffe8ae, w * .46 - .34 + i * .68, FLOOR + .009, -d + 1.5, 0);
      light.rotation.y = -.23;
      light.material = this.material(0xffedb5, .14, .15);
      light.castShadow = false;
    }
    const pendant = new THREE.Group();
    pendant.position.set(0, FLOOR + 3.55, -.35);
    this.cylinder(pendant, .08, .08, .035, PALETTE.brass);
    this.cylinder(pendant, .016, .016, .35, PALETTE.oakDark, 0, -.17, 0);
    this.cylinder(pendant, .16, .4, .26, 0xf1dfae, 0, -.42, 0);
    this.cylinder(pendant, .405, .405, .035, PALETTE.brass, 0, -.56, 0);
    const bulb = this.ball(pendant, .085, .075, .085, 0xffedb2, 0, -.58, 0);
    bulb.material = this.material(0xffedb2, .6);
    const warmLight = new THREE.PointLight(0xffdfa0, 3.5, 10, 2);
    warmLight.position.set(0, -.72, 0);
    pendant.add(warmLight);
    room.add(pendant);
  }

  private window() {
    const window = new THREE.Group();
    this.box(window, 1.82, 1.71, .1, PALETTE.oakDark, 0, 0, 0, .045);
    const glass = this.box(window, 1.63, 1.52, .07, 0xb9e2dd, 0, 0, .06, .02);
    glass.material = this.material(0xb9e2dd, .16);
    this.box(window, 1.61, .38, .016, 0xd5eacb, 0, -.54, .104, .01);
    // Soft clouds are original simple shapes, visible through the four window panes.
    for (const [x, y, sx] of [[-.43, .38, .26], [-.2, .39, .23], [.39, .09, .28]]) this.ball(window, sx, .095, .018, 0xfff5dd, x, y, .12);
    for (const x of [-.84, 0, .84]) this.box(window, .065, 1.64, .08, PALETTE.trim, x, 0, .16, .012);
    for (const y of [-.8, 0, .8]) this.box(window, 1.74, .065, .08, PALETTE.trim, 0, y, .16, .012);
    this.box(window, 2.04, .1, .32, PALETTE.trim, 0, -.87, .18, .028);
    const rod = this.cylinder(window, .025, .025, 2.23, PALETTE.brass, 0, .94, .22);
    rod.rotation.z = Math.PI / 2;
    for (const sign of [-1, 1]) {
      this.ball(window, .055, .055, .055, PALETTE.brass, sign * 1.14, .94, .22);
      for (let i = 0; i < 4; i++) {
        const fold = this.box(window, .12, 1.66, .085, i % 2 ? 0x91b2a2 : 0xa4c1ae, sign * (.83 + i * .085), .02, .24 + Math.sin(i * 1.3) * .025, .035);
        fold.rotation.z = sign * -.038;
      }
      this.box(window, .38, .067, .12, PALETTE.cream, sign * .95, -.4, .285, .02);
    }
    return window;
  }

  private wallArt(parent: THREE.Object3D, x: number, y: number, z: number) {
    const art = new THREE.Group();
    art.position.set(x, y, z);
    this.box(art, 1.05, 1.26, .085, PALETTE.oak, 0, 0, 0, .045);
    this.box(art, .88, 1.09, .02, PALETTE.cream, 0, 0, .053, .01);
    const stem = this.box(art, .02, .62, .012, PALETTE.teal, .015, -.035, .07, .003);
    stem.rotation.z = -.17;
    for (let i = 0; i < 5; i++) {
      const sign = i % 2 ? 1 : -1;
      const leaf = this.ball(art, .105, .17, .012, i % 2 ? 0x9ab395 : 0x719c86, sign * .085 + (i - 2) * .015, -.25 + i * .12, .078);
      leaf.rotation.z = sign * -.78;
    }
    this.box(art, .33, .012, .009, 0xcfbe9d, 0, -.4, .07, 0);
    parent.add(art);
  }

  private buildFurniture(group: THREE.Group, kind: FurnitureKind) {
    switch (kind) {
      case 'bed': this.bed(group); break;
      case 'table': this.table(group); break;
      case 'chair': this.chair(group); break;
      case 'plant': this.plant(group); break;
      case 'radio': this.radio(group); break;
      case 'lamp': this.lamp(group); break;
      case 'bookshelf': this.bookshelf(group); break;
      case 'rug': this.rug(group); break;
    }
  }

  private bed(group: THREE.Group) {
    for (const x of [-.65, .65]) for (const z of [-.98, .98]) this.cylinder(group, .065, .075, .31, PALETTE.oakDark, x, .155, z);
    this.box(group, 1.59, .21, 2.34, PALETTE.oak, 0, .34, 0, .06);
    this.box(group, 1.53, 1.02, .14, PALETTE.oakLight, 0, .82, -1.12, .06);
    this.box(group, 1.3, .55, .035, PALETTE.oak, 0, .94, -1.037, .035);
    for (let x = -.5; x <= .51; x += .25) this.box(group, .055, .45, .04, PALETTE.oakLight, x, .94, -1.014, .01);
    this.box(group, 1.45, .3, 2.11, PALETTE.cream, 0, .565, 0, .1);
    this.box(group, 1.48, .09, 1.48, PALETTE.sage, 0, .756, .29, .035);
    for (const x of [-.723, .723]) this.box(group, .055, .28, 1.49, PALETTE.sage, x, .655, .29, .02);
    this.box(group, 1.44, .075, .2, 0xb8ceaf, 0, .8, -.35, .025);
    this.box(group, 1.46, .12, .2, 0xb8ceaf, 0, .758, .96, .025);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      this.box(group, .19, .008, .2, (row + col) % 2 ? 0xa8c09c : 0x6e977e, -.51 + col * .34, .807, -.11 + row * .3, .008).castShadow = false;
    }
    for (const x of [-.35, .35]) {
      this.box(group, .61, .19, .43, 0xfff4df, x, .788, -.79, .07);
      this.box(group, .038, .016, .34, 0xe8dbc1, x - .19, .884, -.79, .006);
    }
    this.box(group, 1.55, .31, .11, PALETTE.oakLight, 0, .56, 1.13, .045);
  }

  private table(group: THREE.Group) {
    const top = this.cylinder(group, .745, .745, .105, PALETTE.oakLight, 0, .81, 0);
    top.scale.z = .65;
    const rim = this.cylinder(group, .705, .715, .065, PALETTE.oak, 0, .731, 0);
    rim.scale.z = .65;
    for (const x of [-.44, .44]) for (const z of [-.25, .25]) this.stick(group, new THREE.Vector3(x, .04, z), new THREE.Vector3(x * .84, .76, z * .84), .044, PALETTE.oak);
    // Little ceramic cup and a tiny sprig make the table feel lived in.
    this.cylinder(group, .1, .086, .15, PALETTE.cream, -.26, .942, .08);
    this.cylinder(group, .075, .075, .007, 0x9d7252, -.26, 1.02, .08);
    const handle = this.mesh(group, new THREE.TorusGeometry(.052, .016, 8, 18), PALETTE.cream, -.373, .947, .08);
    handle.rotation.y = Math.PI / 2;
    this.cylinder(group, .083, .065, .23, PALETTE.coral, .27, .987, -.08);
    this.stick(group, new THREE.Vector3(.27, 1.08, -.08), new THREE.Vector3(.29, 1.33, -.08), .008, PALETTE.sage);
    for (const sign of [-1, 1]) {
      const leaf = this.ball(group, .07, .027, .035, PALETTE.sage, .29 + sign * .045, 1.23, -.08);
      leaf.rotation.z = sign * .6;
    }
  }

  private chair(group: THREE.Group) {
    for (const x of [-.27, .27]) for (const z of [-.27, .27]) this.stick(group, new THREE.Vector3(x * 1.09, .035, z * 1.09), new THREE.Vector3(x, .51, z), .038, PALETTE.oak);
    this.box(group, .73, .095, .73, PALETTE.oakLight, 0, .52, 0, .065);
    this.box(group, .65, .115, .61, PALETTE.coral, 0, .622, .025, .055);
    for (const x of [-.28, .28]) this.box(group, .055, .62, .06, PALETTE.oak, x, .85, -.29, .02);
    this.box(group, .72, .31, .09, PALETTE.oakLight, 0, 1.05, -.3, .07);
    this.box(group, .56, .22, .05, 0xe8c394, 0, 1.05, -.238, .045);
  }

  private plant(group: THREE.Group) {
    this.cylinder(group, .3, .22, .38, 0xe1b397, 0, .2, 0);
    this.cylinder(group, .318, .31, .072, 0xecc8ac, 0, .38, 0);
    this.cylinder(group, .276, .276, .012, 0x736148, 0, .419, 0);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const height = .71 + (i % 3) * .18;
      const reach = i % 2 ? .23 : .16;
      const x = Math.sin(angle) * reach, z = Math.cos(angle) * reach;
      this.stick(group, new THREE.Vector3(0, .41, 0), new THREE.Vector3(x, height, z), .016, 0x698858);
      const leaf = this.ball(group, .117, .27, .065, i % 2 ? 0x71995c : 0x90ac71, x, height + .08, z);
      leaf.rotation.set(Math.cos(angle) * .43, angle, Math.sin(angle) * -.43);
      const vein = this.box(leaf, .035, 1.23, .07, 0xa2b883, 0, .02, .99, .01);
      vein.castShadow = false;
    }
  }

  private radio(group: THREE.Group) {
    for (const x of [-.23, .23]) this.box(group, .065, .08, .29, PALETTE.oakDark, x, .04, 0, .02);
    this.box(group, .63, .44, .41, 0xb98760, 0, .31, 0, .065);
    this.box(group, .56, .36, .04, PALETTE.cream, 0, .31, .211, .035);
    this.box(group, .31, .26, .02, 0xc7af83, -.093, .32, .238, .045);
    for (let i = -3; i <= 3; i++) this.box(group, .245, .012, .012, 0xa48b64, -.095, .32 + i * .03, .253, .005);
    for (const y of [.23, .39]) {
      const knob = this.cylinder(group, .045, .045, .03, PALETTE.oakDark, .19, y, .256);
      knob.rotation.x = Math.PI / 2;
      this.box(group, .007, .047, .006, PALETTE.cream, .19, y, .276, .002);
    }
    for (const x of [-.15, .15]) this.box(group, .034, .13, .05, PALETTE.oakDark, x, .57, 0, .015);
    this.box(group, .34, .043, .05, PALETTE.oakDark, 0, .64, 0, .016);
    this.stick(group, new THREE.Vector3(.23, .52, -.07), new THREE.Vector3(.29, .91, -.07), .009, 0xb5b9a9);
  }

  private lamp(group: THREE.Group) {
    this.cylinder(group, .26, .3, .07, PALETTE.brass, 0, .04, 0);
    this.cylinder(group, .035, .038, 1.32, PALETTE.oak, 0, .73, 0);
    const shade = this.cylinder(group, .23, .325, .42, 0xf6e9c4, 0, 1.45, 0);
    shade.material = this.material(0xf6e9c4, .18);
    this.cylinder(group, .331, .331, .025, 0xd4b887, 0, 1.245, 0);
    this.cylinder(group, .234, .234, .024, 0xd4b887, 0, 1.66, 0);
    this.ball(group, .045, .035, .045, PALETTE.brass, 0, 1.693, 0);
    const glow = new THREE.PointLight(0xffdc9c, 1.1, 3, 2);
    glow.position.y = 1.2;
    group.add(glow);
  }

  private bookshelf(group: THREE.Group) {
    for (const x of [-.64, .64]) this.box(group, .09, .16, .4, PALETTE.oakDark, x, .08, 0, .02);
    this.box(group, 1.44, 1.59, .065, 0xbd966c, 0, .91, -.24, .012);
    for (const x of [-.705, .705]) this.box(group, .075, 1.63, .54, PALETTE.oakLight, x, .91, 0, .015);
    for (const y of [.135, .66, 1.19, 1.72]) this.box(group, 1.5, .072, .55, PALETTE.oakLight, 0, y, 0, .016);
    const colors = [0x89aa96, 0xe4ae8e, 0x879ca7, 0xd3bf90, 0xb2b989, 0xca8d7d];
    for (let shelf = 0; shelf < 3; shelf++) {
      let x = -.59;
      const count = shelf === 1 ? 5 : 7;
      for (let i = 0; i < count; i++) {
        const width = .095 + (i % 3) * .018, height = .3 + (i % 3) * .038;
        this.box(group, width, height, .34, colors[(i + shelf * 2) % colors.length], x + width / 2, .18 + shelf * .53 + height / 2, .025, .006);
        this.box(group, width * .62, .012, .006, 0xf0e0be, x + width / 2, .25 + shelf * .53, .199, .001);
        x += width + .018;
      }
    }
    this.box(group, .32, .29, .36, 0xe4cba3, .43, .85, .025, .025);
    this.box(group, .11, .035, .012, PALETTE.oakDark, .43, .88, .211, .01);
    const littlePlant = new THREE.Group();
    this.plant(littlePlant);
    littlePlant.scale.setScalar(.44);
    littlePlant.position.set(.4, 1.76, -.03);
    group.add(littlePlant);
    this.box(group, .4, .048, .29, PALETTE.coral, -.3, 1.78, 0, .01);
    this.box(group, .34, .042, .26, PALETTE.teal, -.29, 1.825, 0, .01);
  }

  private rug(group: THREE.Group) {
    this.box(group, 2.68, .018, 1.88, 0xe6d9b7, 0, .016, 0, .04).castShadow = false;
    this.box(group, 2.49, .006, 1.69, 0x98b5a2, 0, .028, 0, .028).castShadow = false;
    for (const z of [-.7, -.58, .58, .7]) this.box(group, 2.44, .004, .03, 0xe9e2c3, 0, .033, z, .001).castShadow = false;
    for (const x of [-1.2, 1.2]) this.box(group, .035, .004, 1.5, 0xe9e2c3, x, .033, 0, .001).castShadow = false;
    for (const x of [-.76, 0, .76]) {
      const motif = this.box(group, .3, .004, .3, 0xc7d1ad, x, .033, 0, .003);
      motif.rotation.y = Math.PI / 4;
      motif.castShadow = false;
    }
    for (let i = -10; i <= 10; i++) for (const sign of [-1, 1]) this.box(group, .025, .009, .085, 0xe9dbb8, i * .12, .019, sign * .914, .002).castShadow = false;
  }
}
