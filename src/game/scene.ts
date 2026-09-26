import * as THREE from 'three';
import type { Decoration, FurnitureKind, Position, SceneOptions, SceneSnapshot, WorldEntity } from './types';
import { HomeInterior } from './interior';
import { PLAYER_START, WORLD_ENTITIES } from './world';

const GROUND = 0.43;
const RIVER = [new THREE.Vector2(-1.7, -13), new THREE.Vector2(-1.2, -10.1), new THREE.Vector2(2, -8.4), new THREE.Vector2(5.7, -7), new THREE.Vector2(6.8, -4.5), new THREE.Vector2(7.2, -1.6), new THREE.Vector2(9, .5), new THREE.Vector2(12.1, 1.5), new THREE.Vector2(16, 4.2)];
const COLORS = { grass: 0x80bb5d, grassSide: 0x6c9c4d, sand: 0xf0dfb1, sandSide: 0xe5cca0, sea: 0xaddbd6, river: 0x72c8c5, wood: 0xa3744e, darkWood: 0x795b42, peach: 0xf49c81 };

function random(seed: number) { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function material(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .88, flatShading: false, ...extra }); }
function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D, x = 0, y = 0, z = 0) { const obj = new THREE.Mesh(geometry, mat); obj.position.set(x, y, z); obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj; }
function box(parent: THREE.Object3D, size: [number, number, number], color: THREE.ColorRepresentation | THREE.Material, x = 0, y = 0, z = 0, rounding = false) { const mat = color instanceof THREE.Material ? color : material(color); const obj = mesh(new THREE.BoxGeometry(...size), mat, parent, x, y, z); if (rounding) obj.rotation.y = .06; return obj; }
function ball(parent: THREE.Object3D, radius: number, color: THREE.ColorRepresentation | THREE.Material, x = 0, y = 0, z = 0, detail = 1) { return mesh(detail === 0 ? new THREE.IcosahedronGeometry(radius, 0) : new THREE.SphereGeometry(radius, detail > 1 ? 24 : 16, detail > 1 ? 16 : 12), color instanceof THREE.Material ? color : material(color), parent, x, y, z); }
function cylinder(parent: THREE.Object3D, rTop: number, rBottom: number, height: number, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0, sides = 10) { return mesh(new THREE.CylinderGeometry(rTop, rBottom, height, sides), material(color), parent, x, y, z); }
function segment(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, sides = 8) { const diff = b.clone().sub(a); const obj = cylinder(parent, radius, radius, diff.length(), color, 0, 0, 0, sides); obj.position.copy(a.clone().add(b).multiplyScalar(.5)); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize()); return obj; }
function disc(parent: THREE.Object3D, radius: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, opacity = 1) { const obj = mesh(new THREE.CircleGeometry(radius, 48), material(color, { transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }), parent, x, y, z); obj.rotation.x = -Math.PI / 2; obj.castShadow = false; return obj; }
function line(parent: THREE.Object3D, points: THREE.Vector3[], color: THREE.ColorRepresentation, opacity = 1) { const obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); parent.add(obj); return obj; }
function patch(parent: THREE.Object3D, points: THREE.Vector2[], color: THREE.ColorRepresentation, y: number) { const shape = new THREE.Shape(); points.forEach((p, i) => i ? shape.lineTo(p.x, -p.y) : shape.moveTo(p.x, -p.y)); shape.closePath(); const obj = mesh(new THREE.ShapeGeometry(shape), material(color), parent, 0, y, 0); obj.rotation.x = -Math.PI / 2; obj.castShadow = false; return obj; }
function ribbon(parent: THREE.Object3D, points: THREE.Vector2[], width: number, color: THREE.ColorRepresentation, y: number) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, y, p.y))); const positions: number[] = []; const indices: number[] = []; for (let i = 0; i <= 100; i++) { const p = curve.getPoint(i / 100); const tangent = curve.getTangent(i / 100); const nx = -tangent.z * width / 2, nz = tangent.x * width / 2; positions.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz); if (i < 100) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); } } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); const obj = mesh(geo, material(color, { side: THREE.DoubleSide }), parent); obj.castShadow = false; return curve; }

interface RenderedEntity { entity: WorldEntity; group: THREE.Group; fruit?: THREE.Group; wings?: THREE.Group[]; roamTarget?: THREE.Vector2; idleUntil?: number; legs?: THREE.Group[]; }
type ActionKind = 'shake' | 'dig' | 'net' | 'pickup' | 'cast' | 'bite' | 'catch';
interface PlayerAction { kind: ActionKind; started: number; duration: number; entity?: WorldEntity; }
interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; age: number; life: number; }

export class IslandScene {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.OrthographicCamera(-20, 20, 15, -15, .1, 150);
  private readonly options: SceneOptions;
  private readonly container: HTMLElement;
  private readonly clock = new THREE.Clock();
  private readonly root = new THREE.Group();
  private readonly actors = new THREE.Group();
  private readonly interior = new HomeInterior();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly presentation = new THREE.Group();
  private readonly particles: Particle[] = [];
  private action: PlayerAction | null = null;
  private bobber: THREE.Group | null = null;
  private fishingLine: THREE.Line | null = null;
  private location: 'island' | 'home' = 'island';
  private outdoorPosition: Position = { ...PLAYER_START };
  private readonly fadedMaterials = new Map<THREE.MeshStandardMaterial, number>();
  private lastFootstep = 0;
  private readonly player = new THREE.Group();
  private readonly playerLegs: THREE.Group[] = [];
  private readonly playerArms: THREE.Group[] = [];
  private readonly toolGroup = new THREE.Group();
  private readonly entityMeshes: THREE.Object3D[] = [];
  private readonly entities = new Map<string, RenderedEntity>();
  private readonly decorationMeshes = new Map<string, THREE.Group>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private readonly waterLines: THREE.Line[] = [];
  private readonly smoke: THREE.Mesh[] = [];
  private readonly trees: THREE.Group[] = [];
  private readonly fireflies: THREE.Mesh[] = [];
  private readonly ambient = new THREE.HemisphereLight(0xfff7dc, 0x6d978b, 1.75);
  private readonly oceanMaterial = new THREE.MeshBasicMaterial({ color: COLORS.sea, toneMapped: false });
  private readonly sunlight = new THREE.DirectionalLight(0xfff2db, 2.2);
  private readonly selection: THREE.Mesh;
  private readonly waypointRing: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver;
  private snapshot: SceneSnapshot = { gathered: [], decorations: [], tool: 'hand', timeOfDay: 'day', paused: false };
  private waypoint: THREE.Vector2 | null = null;
  private route: THREE.Vector2[] = [];
  private targetEntity: WorldEntity | null = null;
  private pendingVisit: string | null = null;
  private near: WorldEntity | null = null;
  private frame = 0;
  private elapsed = 0;
  private lastMove = 0;
  private moving = false;
  private destroyed = false;
  private cameraView: 'close' | 'normal' | 'wide' = 'normal';
  private pointerStart = { x: 0, y: 0 };
  private lanternLights: THREE.Mesh[] = [];

  constructor(container: HTMLElement, options: SceneOptions) {
    this.container = container;
    this.options = options;
    this.scene.background = new THREE.Color(0xc2e4ed);
    this.scene.fog = new THREE.Fog(COLORS.sea, 60, 130);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .9;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    this.renderer.domElement.setAttribute('aria-label', 'Little Isle. Use WASD or arrow keys to move, E to interact, or click a place to walk there.');
    this.renderer.domElement.setAttribute('role', 'img');
    container.appendChild(this.renderer.domElement);
    this.scene.add(this.root, this.actors, this.interior.group, this.ambient, this.sunlight);
    this.actors.add(this.presentation); this.interior.group.visible = false;
    this.sunlight.position.set(-15, 30, 14);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    this.sunlight.shadow.camera.left = -27;
    this.sunlight.shadow.camera.right = 27;
    this.sunlight.shadow.camera.top = 26;
    this.sunlight.shadow.camera.bottom = -26;
    this.sunlight.shadow.camera.near = 1;
    this.sunlight.shadow.camera.far = 80;
    this.sunlight.shadow.normalBias = .045;
    this.sunlight.shadow.bias = -.0003;
    this.sunlight.shadow.radius = 3;
    this.camera.position.set(0, 11, 14);
    this.camera.lookAt(0, 1, 0);
    this.buildLandscape();
    this.buildWorld();
    this.buildPlayer();
    this.setPlayer(options.initialPlayer ?? PLAYER_START);
    this.selection = mesh(new THREE.RingGeometry(.85, .94, 48), material(0xfff7d1, { transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }), this.actors);
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.castShadow = false;
    this.selection.visible = false;
    this.waypointRing = mesh(new THREE.RingGeometry(.25, .35, 40), material(0xfffbdf, { transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }), this.actors);
    this.waypointRing.rotation.x = -Math.PI / 2;
    this.waypointRing.castShadow = false;
    this.waypointRing.visible = false;
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.pointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.pointerMove);
    this.resize();
    this.animate();
    options.onReady?.();
  }

  private readonly resize = () => {
    const width = this.container.clientWidth || 1, height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const base = this.location === 'home' ? ((this.snapshot.homeLevel ?? 0) > 0 ? 12.8 : 10.8) : this.cameraView === 'close' ? 10.5 : this.cameraView === 'wide' ? 17 : 13;
    const roomWidth = (this.snapshot.homeLevel ?? 0) > 0 ? 10.7 : 8.7;
    const span = this.location === 'home' ? Math.max(base, roomWidth / aspect) : base;
    this.camera.left = -span * aspect / 2;
    this.camera.right = span * aspect / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  };

  private buildLandscape() {
    const ocean = mesh(new THREE.PlaneGeometry(250, 250), this.oceanMaterial, this.root, 0, -.65, 0);
    ocean.rotation.x = -Math.PI / 2;
    ocean.castShadow = false;
    const coastPoints = (scale: number) => Array.from({ length: 88 }, (_, i) => {
      const a = i / 88 * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + .8) * .055 + Math.sin(a * 7 - .3) * .025;
      return new THREE.Vector2(Math.cos(a) * 17.2 * r * scale, Math.sin(a) * 13.8 * r * scale - .8);
    });
    patch(this.root, coastPoints(1.14), 0x9ed3cd, -.62);
    patch(this.root, coastPoints(1.085), 0xbadfd3, -.60);
    patch(this.root, coastPoints(1.044), 0xd5e7d2, -.57);
    const landLayer = (scale: number, height: number, depth: number, top: number, side: number) => {
      const s = new THREE.Shape(); coastPoints(scale).forEach((p, i) => i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .13, bevelSegments: 2, steps: 1 });
      const obj = mesh(geo, [material(top), material(side)], this.root, 0, height - depth, 0); obj.rotation.x = -Math.PI / 2;
    };
    landLayer(1, .05, .6, COLORS.sand, COLORS.sandSide);
    landLayer(.885, GROUND - .045, .25, COLORS.grass, COLORS.grassSide);
    ribbon(this.root, RIVER, 2.38, 0xdad49c, GROUND + .006);
    ribbon(this.root, RIVER, 1.96, COLORS.river, GROUND + .018);
    ribbon(this.root, RIVER, .92, 0x78c9c2, GROUND + .021);
    const paths: THREE.Vector2[][] = [
      [new THREE.Vector2(-5.1, -4.5), new THREE.Vector2(-5, -2), new THREE.Vector2(-3, .3), new THREE.Vector2(-.7, 2), new THREE.Vector2(1.1, 5.5), new THREE.Vector2(1.1, 10.7)],
      [new THREE.Vector2(-10.2, 2), new THREE.Vector2(-6.7, 2), new THREE.Vector2(-3.8, 1.2), new THREE.Vector2(-.7, 2), new THREE.Vector2(3, .1), new THREE.Vector2(5.3, -3.4), new THREE.Vector2(8.8, -3.4), new THREE.Vector2(11.3, -4.2)],
      [new THREE.Vector2(-1, 2), new THREE.Vector2(1, -.4), new THREE.Vector2(1, -3.9)],
    ];
    paths.forEach(p => { ribbon(this.root, p, 1.8, 0xc4ba87, GROUND + .027); ribbon(this.root, p, 1.59, 0xe4d4a3, GROUND + .035); });
    disc(this.root, 2.2, 0xe7d7ab, -.7, GROUND + .04, 2);
    // Gentle, hand-drawn looking ripples make the water feel like a miniature world.
    for (let i = 0; i < 160; i++) {
      const x = (random(i + 4) - .5) * 92, z = (random(i + 400) - .5) * 74;
      if (x * x / 350 + z * z / 245 < 1.08) continue;
      const len = .3 + random(i + 500) * 1.4;
      const pts = Array.from({ length: 10 }, (_, j) => new THREE.Vector3(x + j / 9 * len, -.595, z + Math.sin(j / 9 * Math.PI) * .09));
      const ripple = line(this.root, pts, 0xe3f1df, .42); this.waterLines.push(ripple);
    }
    for (let i = 0; i < 15; i++) {
      const t = (i + .5) / 16; const curve = new THREE.CatmullRomCurve3(RIVER.map(p => new THREE.Vector3(p.x, GROUND + .031, p.y))); const p = curve.getPoint(t);
      this.waterLines.push(line(this.root, [p.clone().add(new THREE.Vector3(-.31, 0, .1)), p.clone(), p.clone().add(new THREE.Vector3(.29, 0, -.02))], 0xd7ede1, .65));
    }
    // Tiny grass clusters and sandy freckles break up the large fields of color.
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.06, 1, 3), material(0x85ab61), 1020);
    grass.receiveShadow = true;
    const blade = new THREE.Object3D();
    let grassCount = 0;
    for (let i = 0; i < 340; i++) {
      const x = (random(i + 1000) - .5) * 31, z = (random(i + 2000) - .5) * 24;
      if (x * x / 215 + (z + 1) * (z + 1) / 125 > .92 || this.riverDistance(x, z) < 1.4 || (Math.abs(x + .5) < 2.5 && z > -3)) continue;
      for (let j = 0; j < 3; j++) {
        const height = .17 + random(i + j) * .15;
        blade.position.set(x + (j - 1) * .09, GROUND + .03 + height / 2, z + random(i * 3 + j) * .1);
        blade.rotation.set(0, 0, (j - 1) * -.27); blade.scale.set(1, height, 1); blade.updateMatrix();
        grass.setMatrixAt(grassCount++, blade.matrix);
      }
    }
    grass.count = grassCount; grass.instanceMatrix.needsUpdate = true; this.root.add(grass);
    for (let i = 0; i < 80; i++) {
      const a = random(i + 600) * Math.PI * 2; const r = .91 + random(i + 800) * .06; const x = Math.cos(a) * 17 * r, z = Math.sin(a) * 13.6 * r - .8;
      const s = .025 + random(i + 900) * .06; disc(this.root, s, 0xd8c399, x, .18, z);
    }
    this.buildBridge(); this.buildDock(); this.buildGarden();
  }

  private buildBridge() {
    const bridge = new THREE.Group(); bridge.position.set(6.85, GROUND + .07, -3.45); bridge.rotation.y = -.1; this.root.add(bridge);
    for (let i = 0; i < 15; i++) { const x = (i - 7) * .245; const rise = Math.cos((i - 7) / 7 * Math.PI / 2) * .29;
      box(bridge, [.225, .14, 1.75], i % 3 ? 0xcaa375 : 0xd7b183, x, rise, 0);
      for (const z of [-.65, .65]) cylinder(bridge, .024, .024, .012, 0x80684d, x, rise + .078, z, 5);
    }
    for (const z of [-.92, .92]) {
      for (const x of [-1.72, 0, 1.72]) { const y = x === 0 ? .85 : .65; box(bridge, [.15, 1.2, .15], 0xb0885f, x, y - .4, z); ball(bridge, .13, 0xd2ad79, x, y + .25, z); }
      segment(bridge, new THREE.Vector3(-1.75, .72, z), new THREE.Vector3(0, .93, z), .062, 0xbc966b);
      segment(bridge, new THREE.Vector3(0, .93, z), new THREE.Vector3(1.75, .72, z), .062, 0xbc966b);
      segment(bridge, new THREE.Vector3(-1.75, .32, z), new THREE.Vector3(0, .53, z), .04, 0xb78b60);
      segment(bridge, new THREE.Vector3(0, .53, z), new THREE.Vector3(1.75, .32, z), .04, 0xb78b60);
    }
  }

  private buildDock() {
    const dock = new THREE.Group(); dock.position.set(1.15, .18, 13.3); this.root.add(dock);
    for (let i = 0; i < 14; i++) box(dock, [2.15, .18, .29], i % 3 === 0 ? 0xbd9a72 : 0xc9a780, 0, 0, (i - 5) * .32);
    for (const x of [-1.02, 1.02]) for (const z of [-1.5, .4, 2.5]) { cylinder(dock, .13, .14, 1.55, 0x967452, x, -.23, z); cylinder(dock, .155, .155, .12, 0xd4b285, x, .6, z); }
    const boat = new THREE.Group(); boat.position.set(3.1, -.6, 14.6); boat.rotation.y = -.3; this.root.add(boat);
    const hull = ball(boat, 1, 0xefc689, 0, 0, 0, 1); hull.scale.set(.67, .38, 1.7);
    const inside = ball(boat, 1, 0xa47b56, 0, .16, 0, 1); inside.scale.set(.52, .11, 1.43);
    box(boat, [1.14, .09, .31], 0xe7ba82, 0, .3, .36); box(boat, [1.02, .09, .31], 0xe7ba82, 0, .3, -.55);
    segment(boat, new THREE.Vector3(-.5, .33, -.9), new THREE.Vector3(.6, .38, 1.2), .045, 0xe4ce9e);
    const paddle = box(boat, [.25, .07, .6], 0xe4ce9e, .57, .38, 1.2); paddle.rotation.y = .46;
    const rope = new THREE.CatmullRomCurve3([new THREE.Vector3(2.65, -.15, 13.45), new THREE.Vector3(2.05, .07, 13.25), new THREE.Vector3(2.15, .76, 13.7)]);
    mesh(new THREE.TubeGeometry(rope, 12, .025, 5, false), material(0xb5996a), this.root);
    this.buildSign(3.1, 10.3, 'THE BEACH', -.18);
  }

  private buildGarden() {
    const garden = new THREE.Group(); garden.position.set(-.3, GROUND, -5.4); this.root.add(garden);
    for (let row = 0; row < 3; row++) {
      box(garden, [2.6, .09, .65], 0x94745b, 0, .055, row * .95);
      for (const x of [-1.38, 1.38]) box(garden, [.11, .2, .82], 0xc6a278, x, .1, row * .95);
      for (const z of [-.39, .39]) box(garden, [2.8, .2, .1], 0xc6a278, 0, .1, row * .95 + z);
      for (let col = 0; col < 5; col++) { const x = (col - 2) * .46; const z = row * .95;
        if (row === 0) { const leaf = ball(garden, .2, 0x6b9950, x, .3, z); leaf.scale.set(1, .7, 1); ball(garden, .13, 0x92b367, x - .06, .42, z); }
        else this.flower(garden, x, .15, z, row === 1 ? 0xefb477 : 0xfcf0cd, .68);
      }
    }
    for (let i = 0; i < 5; i++) this.fence(-2.4 + i * 1.0, -6.35, .9, 0);
    const can = cylinder(garden, .23, .25, .4, 0x79aaa0, 1.9, .23, 1.4); can.rotation.z = -.15;
    segment(garden, new THREE.Vector3(2, .3, 1.4), new THREE.Vector3(2.5, .63, 1.4), .055, 0x79aaa0);
    const handle = mesh(new THREE.TorusGeometry(.19, .035, 5, 12), material(0x79aaa0), garden, 1.68, .37, 1.4); handle.rotation.y = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const stone = ball(this.root, .43, 0xdbd7bc, -3.5 + i * .2, GROUND + .065, -3.7 + i * .8, 0); stone.scale.set(.85, .17, 1); }
    this.flowerBed(-6.8, -4.7, 11, 1); this.flowerBed(5.3, 6, 13, 2); this.flowerBed(-8, 5.2, 9, 3); this.flowerBed(10, -3.6, 9, 4);
    this.buildBench(4.2, 3.0, -.5);
    this.buildLamp(-6.8, -2.9); this.buildLamp(3.8, -.8); this.buildLamp(9.3, -2.7);
    this.buildSign(-2.55, 3.35, 'LITTLE ISLE', .1);
    // A checked picnic blanket, a book and a tiny cup.
    const picnic = new THREE.Group(); picnic.position.set(-5.5, GROUND + .065, 7); picnic.rotation.y = -.18; this.root.add(picnic);
    box(picnic, [2.7, .025, 1.9], 0xffeed5, 0, 0, 0);
    for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) if ((x + z) % 2 === 0) box(picnic, [.45, .009, .475], 0xd99783, (x - 2.5) * .45, .017, (z - 1.5) * .475);
    box(picnic, [.65, .12, .47], 0x73988b, -.45, .11, 0); box(picnic, [.58, .085, .45], 0xfaf0d4, -.45, .11, .025);
    cylinder(picnic, .13, .1, .21, 0xf5e9cb, .45, .13, -.3);
    const basket = box(picnic, [.68, .45, .5], 0xbd925e, .65, .25, .5); basket.rotation.y = .13;
    const bh = mesh(new THREE.TorusGeometry(.3, .042, 5, 12, Math.PI), material(0x997044), picnic, .65, .48, .5);
    bh.rotation.y = .15;
    for (let i = 0; i < 6; i++) { const x = -10.7 + i * 1.06; this.fence(x, -9.4, 1, -.03); }
    for (let i = 0; i < 3; i++) this.fence(-11.4, -8.9 + i * 1.06, 1, Math.PI / 2);
  }

  private fence(x: number, z: number, width: number, angle: number) {
    const f = new THREE.Group(); f.position.set(x, GROUND, z); f.rotation.y = angle; this.root.add(f);
    for (const px of [-width / 2, width / 2]) { box(f, [.13, .87, .13], 0xece0b9, px, .43, 0); cylinder(f, 0, .11, .13, 0xf7ebc7, px, .93, 0, 4).rotation.y = Math.PI / 4; }
    for (const y of [.3, .63]) box(f, [width, .14, .09], 0xf4e7c4, 0, y, .015);
  }

  private flower(parent: THREE.Object3D, x: number, y: number, z: number, color: number, scale = 1) {
    const stem = cylinder(parent, .023 * scale, .026 * scale, .42 * scale, 0x638e55, x, y + .2 * scale, z, 5); stem.castShadow = false;
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const petal = ball(parent, .105 * scale, color, x + Math.cos(a) * .11 * scale, y + .43 * scale, z + Math.sin(a) * .11 * scale, 0); petal.scale.y = .6; }
    ball(parent, .075 * scale, 0xefc958, x, y + .47 * scale, z, 0);
    const leaf = ball(parent, .1 * scale, 0x7fa658, x + .07 * scale, y + .21 * scale, z, 0); leaf.scale.set(1.3, .35, .65); leaf.rotation.z = .6;
  }

  private flowerBed(x: number, z: number, count: number, seed: number) {
    for (let i = 0; i < count; i++) { const a = random(seed * 800 + i) * Math.PI * 2; const r = Math.sqrt(random(seed * 200 + i)) * 1.45; this.flower(this.root, x + Math.cos(a) * r, GROUND + .015, z + Math.sin(a) * r, [0xffe9ba, 0xe9a687, 0xfcf4d9, 0xd9abcb][i % 4], .75 + random(i + seed) * .4); }
  }

  private buildBench(x: number, z: number, angle: number, parent: THREE.Object3D = this.root) {
    const g = new THREE.Group(); g.position.set(x, GROUND, z); g.rotation.y = angle; parent.add(g);
    for (const y of [.62, .86, 1.1]) box(g, [1.75, .15, .12], 0xc59b6a, 0, y, -.27);
    for (const zp of [-.12, .08, .28]) box(g, [1.9, .1, .17], 0xd2ab79, 0, .5, zp);
    for (const xp of [-.68, .68]) { box(g, [.12, .6, .12], 0x6c8170, xp, .26, .23); box(g, [.12, 1.13, .12], 0x6c8170, xp, .56, -.27); box(g, [.12, .1, .58], 0x6c8170, xp, .78, .03); }
    return g;
  }

  private buildLamp(x: number, z: number, parent: THREE.Object3D = this.root) {
    const g = new THREE.Group(); g.position.set(x, GROUND, z); parent.add(g);
    cylinder(g, .13, .24, .16, 0x667d64, 0, .08, 0);
    cylinder(g, .055, .085, 1.88, 0x6d826a, 0, .97, 0);
    cylinder(g, .29, .2, .15, 0x64775e, 0, 1.9, 0, 6);
    const glass = box(g, [.34, .4, .34], material(0xffefb1, { emissive: 0xffd580, emissiveIntensity: .25 }), 0, 2.12, 0); this.lanternLights.push(glass);
    for (const px of [-.19, .19]) for (const pz of [-.19, .19]) box(g, [.04, .47, .04], 0x64775e, px, 2.12, pz);
    cylinder(g, .02, .36, .28, 0x64775e, 0, 2.48, 0, 4).rotation.y = Math.PI / 4;
    ball(g, .065, 0x64775e, 0, 2.65, 0);
    return g;
  }

  private buildSign(x: number, z: number, label: string, angle: number) {
    const g = new THREE.Group(); g.position.set(x, GROUND, z); g.rotation.y = angle; this.root.add(g);
    box(g, [.13, 1.15, .13], 0xa4835b, 0, .54, 0);
    box(g, [1.48, .48, .12], 0xc8ac7e, 0, 1.03, 0);
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#d9bd8b'; ctx.fillRect(0, 0, 384, 128); ctx.fillStyle = '#796645'; ctx.font = 'bold 33px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 192, 68); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; mesh(new THREE.PlaneGeometry(1.39, .42), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }), g, 0, 1.03, .066); }
    return g;
  }

  private buildWorld() {
    for (const entity of WORLD_ENTITIES) {
      const g = new THREE.Group(); g.position.set(entity.x, entity.kind === 'shell' ? .17 : GROUND, entity.z); g.userData.entityId = entity.id; this.root.add(g);
      const rendered: RenderedEntity = { entity, group: g }; this.entities.set(entity.id, rendered);
      switch (entity.kind) {
        case 'tree': rendered.fruit = this.buildTree(g, entity.id); break;
        case 'home': this.buildHouse(g); break;
        case 'shop': this.buildShop(g); break;
        case 'rock': { const rock = ball(g, .83, 0xa3aa9a, 0, .36, 0, 0); rock.scale.set(1.15, .74, .94); rock.rotation.y = entity.x; const moss = ball(g, .44, 0x7d9e65, -.21, .77, .05, 0); moss.scale.set(1.15, .2, .86); ball(g, .22, 0xb0b8a3, .9, .14, .21, 0); break; }
        case 'shell': this.buildShell(g); break;
        case 'fish': this.buildFish(g); break;
        case 'butterfly': rendered.wings = this.buildButterfly(g, entity.id === 'butterfly-2' ? 0x84b8ca : 0xf4d680); break;
        case 'villager': rendered.legs = this.buildVillager(g, entity); break;
      }
      g.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.userData.entityId = entity.id; this.entityMeshes.push(obj); } });
    }
    // Smaller, fruitless background trees make the orchard feel established.
    for (const [x, z, scale] of [[-9.4, -9.4, .83], [-14, -3, .73], [7.4, -11.4, .86], [13.8, -5.1, .83], [-6.1, 9.5, .62], [8.8, 9.1, .66]]) {
      const g = new THREE.Group(); g.position.set(x, GROUND, z); g.scale.setScalar(scale); this.root.add(g); const fruit = this.buildTree(g, `${x}`); fruit.visible = false;
    }
    for (const [x, z] of [[-10.8, -4.3], [-13.3, 2.9], [12.2, -6.1], [4.2, 7.9], [-8.8, 8.8]]) {
      for (let i = 0; i < 3; i++) { const s = .65 + i * .22; cylinder(this.root, .06 * s, .09 * s, .24 * s, 0xf6e8cb, x + i * .27, GROUND + .12 * s, z + (i % 2) * .27); const cap = ball(this.root, .2 * s, 0xd49b77, x + i * .27, GROUND + .3 * s, z + (i % 2) * .27, 1); cap.scale.y = .52; }
    }
    for (let i = 0; i < 12; i++) { const f = ball(this.root, .045, material(0xffefb5, { emissive: 0xffe8a0, emissiveIntensity: 2 }), (random(i + 332) - .5) * 23, 1.1 + random(i + 80) * 1.5, (random(i + 677) - .5) * 16); f.visible = false; this.fireflies.push(f); }
  }

  private buildTree(g: THREE.Group, id: string) {
    const seed = id.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
    cylinder(g, .21, .38, 1.82, 0x9c7950, 0, .91, 0, 7);
    segment(g, new THREE.Vector3(0, 1.1, 0), new THREE.Vector3(-.61, 2.05, .1), .12, 0x99754c);
    segment(g, new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(.55, 2.3, -.15), .11, 0x99754c);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; segment(g, new THREE.Vector3(Math.cos(a) * .49, .035, Math.sin(a) * .49), new THREE.Vector3(0, .48, 0), .085, 0x9c7950); }
    const canopy = new THREE.Group(); g.add(canopy); canopy.userData.phase = random(seed) * Math.PI * 2; this.trees.push(canopy);
    const shade = [0x4f914a, 0x5e9e4c, 0x478846, 0x6aa752][seed % 4];
    ball(canopy, 1.47, shade, 0, 2.77, 0, 2).scale.set(1.05, .94, 1);
    ball(canopy, 1.14, 0x6fab55, -.7, 2.68, .45, 1);
    ball(canopy, 1.14, 0x579647, .72, 2.84, .34, 1);
    ball(canopy, 1.03, 0x80b75c, -.17, 3.57, -.02, 1);
    ball(canopy, .94, 0x508b43, .23, 2.61, -.78, 1);
    const fruit = new THREE.Group(); canopy.add(fruit);
    for (const [x, y, z] of [[-.88, 2.65, 1.65], [.82, 2.8, 1.66], [.12, 3.51, 1.33], [1.77, 3.06, .44]]) {
      const peach = new THREE.Group(); peach.position.set(x, y, z); fruit.add(peach);
      ball(peach, .27, 0xed9273, -.085, 0, 0, 1); ball(peach, .255, 0xf3a280, .09, 0, .025, 1);
      segment(peach, new THREE.Vector3(0, .17, 0), new THREE.Vector3(.03, .32, 0), .028, 0x806945, 5);
      const leaf = ball(peach, .13, 0x568b54, .14, .26, 0, 0); leaf.scale.set(1.5, .25, .55); leaf.rotation.z = .25;
    }
    return fruit;
  }

  private buildHouse(g: THREE.Group) {
    box(g, [5.0, .28, 4.08], 0xc9bba0, 0, .14, 0);
    box(g, [4.55, 2.75, 3.62], 0xf6edce, 0, 1.59, 0);
    box(g, [4.64, .22, 3.72], 0xced1ab, 0, .48, 0);
    const front = 1.84;
    // Gabled end walls and generous overhanging terracotta roof.
    for (const x of [-2.275, 2.275]) {
      const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([x, 2.96, -1.81, x, 4.38, 0, x, 2.96, 1.81], 3)); tri.computeVertexNormals(); mesh(tri, material(0xf5e8c7, { side: THREE.DoubleSide }), g);
    }
    for (const side of [-1, 1]) {
      const roof = box(g, [5.35, .2, 2.72], 0xc37e62, 0, 3.61, side * 1.06); roof.rotation.x = side * .59;
      for (let row = 0; row < 5; row++) for (let col = 0; col < 10; col++) {
        const tile = box(g, [.51, .063, .58], [0xd69372, 0xce886a, 0xc88062, 0xda9b78][(col + row * 3) % 4], (col - 4.5) * .524, 4.39 - row * .275, side * (.07 + row * .416)); tile.rotation.x = side * .59;
      }
    }
    cylinder(g, .13, .13, 5.48, 0xbd755c, 0, 4.49, 0, 8).rotation.z = Math.PI / 2;
    for (const x of [-2.62, 2.62]) for (const side of [-1, 1]) segment(g, new THREE.Vector3(x, 4.48, 0), new THREE.Vector3(x, 3.0, side * 2.19), .09, 0xf2dfb7, 4);
    box(g, [.7, 1.55, .67], 0xc3ad91, 1.28, 4.08, -.63);
    for (let i = 0; i < 5; i++) { box(g, [.73, .032, .71], 0xe0cfac, 1.28, 3.51 + i * .28, -.63); if (i % 2 === 0) box(g, [.035, .24, .015], 0xe0cfac, 1.24, 3.64 + i * .28, -.29); }
    box(g, [.86, .19, .81], 0x8a8170, 1.28, 4.88, -.63);
    for (let i = 0; i < 4; i++) { const smoke = ball(g, .23 + i * .12, material(0xf8f2dc, { transparent: true, opacity: .34, depthWrite: false }), 1.28 + i * .13, 5.2 + i * .55, -.63, 1); smoke.castShadow = false; smoke.userData.originY = smoke.position.y; smoke.userData.originX = smoke.position.x; this.smoke.push(smoke); }
    // Mint shutters, flower boxes, round attic window, and a friendly wooden door.
    box(g, [1.09, 2.06, .12], 0xb7996d, .3, 1.33, front + .055);
    box(g, [.83, 1.86, .14], 0x8dafa0, .3, 1.27, front + .13);
    for (let i = 0; i < 4; i++) box(g, [.015, 1.8, .016], 0x739788, .02 + i * .186, 1.29, front + .21);
    ball(g, .062, 0xe3bf6d, .54, 1.2, front + .235);
    box(g, [1.48, .15, .63], 0xd3c5a4, .3, .17, front + .31);
    box(g, [1.76, .12, .58], 0xe3d2ad, .3, .075, front + .59);
    this.houseWindow(g, -1.2, 1.77, front + .07);
    this.houseWindow(g, 1.64, 1.77, front + .07, .73);
    const roundFrame = cylinder(g, .4, .4, .11, 0xb29873, 2.34, 3.31, 0, 24); roundFrame.rotation.z = Math.PI / 2;
    const roundGlass = cylinder(g, .31, .31, .13, 0x91b9b0, 2.37, 3.31, 0, 24); roundGlass.rotation.z = Math.PI / 2;
    box(g, [.15, .64, .054], 0xefe4c1, 2.45, 3.31, 0); box(g, [.15, .053, .64], 0xefe4c1, 2.45, 3.31, 0);
    const sideWindow = new THREE.Group(); sideWindow.position.set(2.33, 1.68, .2); sideWindow.rotation.y = Math.PI / 2; g.add(sideWindow); this.houseWindow(sideWindow, 0, 0, 0, 1.1);
    const awning = box(g, [1.43, .13, .76], 0xdca580, .3, 2.49, front + .26); awning.rotation.x = .16;
    for (const x of [-.29, .89]) segment(g, new THREE.Vector3(x, 2.4, front + .52), new THREE.Vector3(x, 2.02, front), .035, 0xa98a65);
    const wreath = mesh(new THREE.TorusGeometry(.21, .06, 6, 12), material(0x6d9663), g, .3, 1.7, front + .22); wreath.rotation.z = .2;
    ball(g, .05, 0xeeb38a, .28, 1.47, front + .3);
    const mailbox = new THREE.Group(); mailbox.position.set(2.65, 0, 2.8); g.add(mailbox);
    box(mailbox, [.13, 1.16, .13], 0xb99b71, 0, .58, 0); box(mailbox, [.51, .39, .7], 0x84aba0, 0, 1.17, 0);
    box(mailbox, [.39, .027, .018], 0x3e6e65, 0, 1.2, .358); box(mailbox, [.07, .36, .09], 0xe5a27c, .31, 1.46, 0); box(mailbox, [.21, .16, .065], 0xe5a27c, .39, 1.58, 0);
    for (const x of [-2.24, 2.12]) { cylinder(g, .23, .17, .34, 0xc68e69, x, .27, 2.06); for (let i = 0; i < 4; i++) this.flower(g, x + (random(i + 21) - .5) * .26, .42, 2.06 + (random(i + 111) - .5) * .25, 0xf3d594, .85); }
  }

  private houseWindow(g: THREE.Group, x: number, y: number, z: number, scale = 1) {
    const w = new THREE.Group(); w.position.set(x, y, z); w.scale.setScalar(scale); g.add(w);
    box(w, [.93, 1.06, .08], 0xbda883); box(w, [.74, .85, .1], 0x8eb8af, 0, 0, .05);
    for (const side of [-1, 1]) { box(w, [.3, 1.01, .09], 0x7f9e81, side * .62, 0, .05); for (let row = 0; row < 5; row++) box(w, [.28, .025, .016], 0xadc3a0, side * .62, (row - 2) * .17, .107); }
    box(w, [.045, .91, .12], 0xf6eaca, 0, 0, .12); box(w, [.78, .045, .12], 0xf6eaca, 0, 0, .12);
    box(w, [1.03, .2, .35], 0xa38860, 0, -.6, .14);
    for (let i = 0; i < 4; i++) this.flower(w, (i - 1.5) * .22, -.56, .18, i % 2 ? 0xf6e2b5 : 0xe4a483, .65);
  }

  private buildShop(g: THREE.Group) {
    g.rotation.y = .07;
    box(g, [2.9, .19, 2], 0xc5a271, 0, .1, 0);
    box(g, [2.63, .99, .86], 0xb58e62, 0, .65, .48);
    for (let i = 0; i < 9; i++) box(g, [.24, .88, .035], i % 2 ? 0xd0ac77 : 0xc7a170, (i - 4) * .29, .65, .928);
    box(g, [2.83, .14, 1.01], 0xe0c698, 0, 1.2, .49);
    for (const x of [-1.3, 1.3]) box(g, [.14, 2.48, .14], 0xaf8c62, x, 1.25, -.28);
    for (let i = 0; i < 8; i++) { const awning = box(g, [.385, .1, 2.13], i % 2 ? 0xf6edcf : 0x86a886, (i - 3.5) * .385, 2.49, .23); awning.rotation.x = .16; box(g, [.385, .31, .09], i % 2 ? 0xf6edcf : 0x86a886, (i - 3.5) * .385, 2.18, 1.265); }
    box(g, [1.9, .44, .13], 0xd9b982, 0, 2.68, -.2);
    const sign = this.buildText('FERN & FIG', '#725e41', '#dfc594', 1.82, .38); sign.position.set(0, 2.69, -.12); g.add(sign);
    for (const x of [-.83, .02, .83]) { box(g, [.68, .12, .62], 0x927447, x, 1.31, .48); for (let i = 0; i < 5; i++) ball(g, .14, x < -.2 ? 0xe6a16e : x > .3 ? 0xf0d078 : 0x9eaf76, x + (i % 3 - 1) * .17, 1.47 + Math.floor(i / 3) * .07, .42 + (Math.floor(i / 3) - .5) * .19); }
    for (let i = 0; i < 2; i++) { box(g, [.71, .55, .71], 0xc79c67, 1.87, .3 + i * .56, -.01); for (const y of [.14, .32, .49]) box(g, [.75, .075, .05], 0xad814f, 1.87, y + i * .56, .37); }
    const board = new THREE.Group(); board.position.set(-1.96, .7, 1.13); board.rotation.x = -.15; g.add(board);
    box(board, [.78, 1.12, .1], 0xab8b60); box(board, [.65, .9, .12], 0x5d7f6d, 0, .02, .012);
    const label = this.buildText('fresh\n& local', '#e7e7c3', '#5d7f6d', .56, .76); label.position.set(0, .01, .08); board.add(label);
    // A little shopkeeper peeking over the counter.
    const keeper = new THREE.Group(); keeper.position.set(.23, .58, -.32); keeper.scale.setScalar(.82); g.add(keeper);
    this.animalHead(keeper, 0xc0a783, 'bear', 1.2); cylinder(keeper, .31, .38, .65, 0x8d9c78, 0, .61, 0, 8);
  }

  private buildText(text: string, ink: string, background: string, width: number, height: number) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 384, 192); ctx.fillStyle = ink; ctx.font = 'bold 45px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const lines = text.split('\n'); lines.forEach((value, i) => ctx.fillText(value, 192, 96 + (i - (lines.length - 1) / 2) * 56));
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  }

  private buildShell(g: THREE.Group) {
    g.rotation.y = g.position.x * .7;
    for (let i = 0; i < 7; i++) { const a = (i - 3) * .19; const part = ball(g, .25, i % 2 ? 0xffead3 : 0xead4b5, Math.sin(a) * .3, .07, Math.cos(a) * .11, 1); part.scale.set(.38, .3, 1.2); part.rotation.y = a; }
    ball(g, .12, 0xe0bea4, 0, .06, -.15, 0).scale.y = .4;
  }

  private buildFish(g: THREE.Group) {
    const body = ball(g, .25, material(0x3f8d90, { transparent: true, opacity: .68 }), 0, .045, 0, 1); body.scale.set(.57, .08, 1.5);
    const tail = mesh(new THREE.ConeGeometry(.17, .25, 3), material(0x438e91, { transparent: true, opacity: .65 }), g, 0, .045, -.38); tail.rotation.x = Math.PI / 2; tail.scale.z = .06;
    for (let i = 0; i < 2; i++) { const ripple = mesh(new THREE.RingGeometry(.47 + i * .27, .485 + i * .27, 32), material(0xcceae0, { transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }), g, 0, .07 + i * .001, 0); ripple.rotation.x = -Math.PI / 2; ripple.scale.x = .7; ripple.castShadow = false; }
  }

  private buildButterfly(g: THREE.Group, color: number) {
    const wings: THREE.Group[] = [];
    ball(g, .06, 0x726a51, 0, 1.33, 0).scale.set(.65, 1, 2.5);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(0, 1.34, 0); g.add(wing); wings.push(wing);
      const upper = ball(wing, .23, color, side * .19, 0, .04, 1); upper.scale.set(1, .12, .8); upper.rotation.y = side * .45;
      const lower = ball(wing, .16, color, side * .15, 0, -.18, 1); lower.scale.set(1, .13, .85);
      ball(wing, .055, 0xfff0bd, side * .24, .032, .06, 0).scale.y = .2;
    }
    return wings;
  }

  private animalHead(g: THREE.Group, color: number, kind: 'bear' | 'rabbit' | 'duck', y: number) {
    const head = ball(g, .49, color, 0, y, 0, 2); head.scale.set(1, .94, .87);
    if (kind === 'bear') for (const x of [-.37, .37]) { ball(g, .185, color, x, y + .34, -.025, 1); ball(g, .108, 0xdcb69e, x, y + .34, .11, 1); }
    if (kind === 'rabbit') for (const x of [-.22, .22]) { const ear = ball(g, .19, color, x, y + .57, -.04, 1); ear.scale.set(.8, 2.2, .7); const inner = ball(g, .12, 0xe5b4ad, x, y + .62, .075, 1); inner.scale.set(.7, 2.4, .45); }
    if (kind === 'duck') { const beak = ball(g, .19, 0xdb9661, 0, y - .06, .44, 1); beak.scale.set(1.2, .5, 1); ball(g, .09, color, .03, y + .47, -.02, 0); }
    else { const muzzle = ball(g, .21, 0xf4dfbd, 0, y - .13, .375, 1); muzzle.scale.set(1.3, .8, .42); ball(g, .073, 0x665446, 0, y - .06, .474, 0); }
    for (const x of [-.17, .17]) { ball(g, .052, 0x413d32, x, y + .03, .407, 1); ball(g, .017, 0xffffff, x - .01, y + .05, .45, 0); const cheek = ball(g, .083, 0xe6ab96, x * 1.66, y - .1, .364, 1); cheek.scale.z = .3; }
  }

  private buildVillager(g: THREE.Group, entity: WorldEntity) {
    const kind = entity.id === 'pip' ? 'duck' : entity.id === 'clover' ? 'rabbit' : 'bear';
    const color = new THREE.Color(entity.color ?? '#c9a77c').getHex();
    g.rotation.y = entity.id === 'clover' ? .8 : -.45;
    cylinder(g, .28, .42, .7, entity.id === 'pip' ? 0x90b5a5 : entity.id === 'clover' ? 0xd7ab83 : 0x859aab, 0, .64, 0, 10);
    const legs: THREE.Group[] = [];
    for (const x of [-.19, .19]) {
      const leg = new THREE.Group(); leg.position.set(x, .3, 0); g.add(leg); legs.push(leg);
      ball(leg, .16, color, 0, -.13, .07).scale.set(1, .75, 1.4);
      const arm = ball(g, .16, color, x * 2.05, .73, 0); arm.scale.set(.85, 1.6, .85);
    }
    this.animalHead(g, color, kind, 1.32);
    if (kind === 'bear') { for (const y of [.52, .7, .88]) box(g, [.47, .035, .027], 0xe8dec0, 0, y, .325); }
    if (kind === 'rabbit') { ball(g, .15, 0xf9ead9, .32, .6, -.26, 1); this.flower(g, -.32, 1.47, .15, 0xe4c969, .6); }
    if (kind === 'duck') { const hat = cylinder(g, .44, .46, .08, 0xe6c891, 0, 1.77, 0); hat.rotation.z = .07; cylinder(g, .25, .29, .24, 0xe1bf84, 0, 1.9, 0); }
    g.scale.setScalar(1.12);
    return legs;
  }

  private buildPlayer() {
    this.actors.add(this.player);
    const skin = 0xecc29b;
    for (const x of [-.18, .18]) {
      const leg = new THREE.Group(); leg.position.set(x, .53, 0); this.player.add(leg); this.playerLegs.push(leg);
      cylinder(leg, .11, .095, .27, skin, 0, -.11, 0, 12);
      cylinder(leg, .103, .101, .11, 0xfff2d6, 0, -.245, 0, 12);
      const shoe = ball(leg, .15, 0xc97053, 0, -.31, .07); shoe.scale.set(.95, .64, 1.45);
      const sole = ball(leg, .148, 0xf9edcf, 0, -.363, .08); sole.scale.set(1, .18, 1.43);
    }
    cylinder(this.player, .27, .34, .24, 0x5c8982, 0, .57, 0, 16);
    cylinder(this.player, .29, .35, .58, 0xe18b62, 0, .88, 0, 20);
    const collar = mesh(new THREE.TorusGeometry(.19, .045, 8, 24), material(0xfaf0d3), this.player, 0, 1.16, 0); collar.rotation.x = Math.PI / 2;
    for (const x of [-.37, .37]) {
      const arm = new THREE.Group(); arm.position.set(x, 1.08, 0); this.player.add(arm); this.playerArms.push(arm);
      const sleeve = ball(arm, .16, 0xe18b62, 0, -.075, 0); sleeve.scale.y = 1.1;
      cylinder(arm, .09, .085, .25, skin, 0, -.27, 0, 12);
      ball(arm, .113, skin, 0, -.4, .01);
    }
    const head = new THREE.Group(); head.position.y = 1.62; this.player.add(head);
    const face = ball(head, .51, skin, 0, 0, .005, 2); face.scale.set(1.04, .98, .93);
    const hair = ball(head, .52, 0x654737, 0, .1, -.11, 2); hair.scale.set(1.04, .9, .88);
    for (const x of [-.49, .49]) { ball(head, .112, skin, x, -.035, .015); ball(head, .055, 0xdca17c, x, -.03, .104).scale.z = .38; }
    for (const x of [-.32, -.13, .12, .31]) { const fringe = ball(head, .16, 0x654737, x, .29, .31); fringe.scale.set(.85, .65, .57); fringe.rotation.z = x > 0 ? -.24 : .2; }
    for (const x of [-.19, .19]) {
      const white = ball(head, .091, 0xfffaf0, x, .015, .455, 2); white.scale.set(.87, 1.24, .33);
      const eye = ball(head, .066, 0x493d33, x + .008, .009, .486, 2); eye.scale.set(.8, 1.32, .35);
      ball(head, .024, 0xffffff, x - .012, .039, .504);
      const cheek = ball(head, .089, 0xeaa68a, x * 1.73, -.13, .383); cheek.scale.set(1.15, .67, .2);
      const brow = box(head, [.1, .025, .017], 0x71513a, x, .155, .458); brow.rotation.z = x > 0 ? -.07 : .07;
    }
    ball(head, .061, 0xe2a47b, 0, -.09, .496);
    const smile = mesh(new THREE.TorusGeometry(.087, .015, 7, 18, Math.PI), material(0x975d48), head, 0, -.176, .464); smile.rotation.z = Math.PI;
    cylinder(this.player, .63, .65, .07, 0xedd393, 0, 2.02, -.035, 32);
    cylinder(this.player, .4, .46, .29, 0xe9c578, 0, 2.18, -.035, 24);
    cylinder(this.player, .454, .465, .083, 0xa27a55, 0, 2.075, -.035, 24);
    const leaf = ball(this.player, .13, 0x719c52, .37, 2.1, .33); leaf.scale.set(.65, .32, 1.25); leaf.rotation.z = -.6;
    const backpack = ball(this.player, .25, 0xdeb268, 0, .88, -.38); backpack.scale.set(1, 1.05, .58);
    for (const x of [-.18, .18]) box(this.player, [.048, .48, .035], 0xf4dca7, x, .9, .294);
    this.playerArms[1].add(this.toolGroup);
    this.player.rotation.y = .15;
  }

  private updateTool() {
    this.toolGroup.children.forEach(obj => this.disposeObject(obj)); this.toolGroup.clear();
    const g = this.toolGroup; g.position.set(.02, -.37, .02);
    if (this.snapshot.tool === 'net') {
      segment(g, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.12, 1.3, .07), .029, 0xc8a571);
      const rim = mesh(new THREE.TorusGeometry(.34, .03, 5, 24), material(0xe7ddbc), g, .16, 1.58, .07); rim.rotation.y = .25;
      const net = mesh(new THREE.SphereGeometry(.32, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xefe8cc, wireframe: true, transparent: true, opacity: .48 }), g, .16, 1.58, .04); net.rotation.x = Math.PI / 2;
    } else if (this.snapshot.tool === 'rod') {
      segment(g, new THREE.Vector3(0, 0, 0), new THREE.Vector3(.18, 1.74, .12), .025, 0x9a805a);
      line(g, [new THREE.Vector3(.18, 1.74, .12), new THREE.Vector3(.27, 1, .23), new THREE.Vector3(.36, .4, .31)], 0xeae8c8, .8);
      ball(g, .06, 0xcf836b, .36, .4, .31);
    } else if (this.snapshot.tool === 'shovel') {
      segment(g, new THREE.Vector3(0, .3, 0), new THREE.Vector3(0, -.55, .1), .04, 0xa38b64);
      const blade = ball(g, .17, 0x98aa9e, 0, -.64, .13, 1); blade.scale.set(1, 1.25, .25);
      const handle = mesh(new THREE.TorusGeometry(.09, .026, 5, 10), material(0xa38b64), g, 0, .38, 0); handle.scale.y = .8;
    }
  }

  sync(snapshot: SceneSnapshot) {
    const old = this.snapshot;
    this.snapshot = snapshot;
    this.interior.sync(snapshot.room ?? [], snapshot.homeLevel ?? 0);
    if ((snapshot.location ?? 'island') !== this.location) this.switchLocation(snapshot.location ?? 'island');
    else if (old.homeLevel !== snapshot.homeLevel && this.location === 'home') this.resize();
    if (old.paused && !snapshot.paused && this.bobber) this.clearFishing();
    if (snapshot.paused && !old.paused) { this.keys.clear(); this.waypoint = null; this.route = []; this.targetEntity = null; }
    for (const { entity, group, fruit } of this.entities.values()) {
      const gathered = snapshot.gathered.includes(entity.id);
      if (fruit) { fruit.visible = !gathered; if (gathered && !old.gathered.includes(entity.id)) group.userData.shakeUntil = this.elapsed + .65; }
      else if (['shell', 'fish', 'butterfly'].includes(entity.kind)) group.visible = !gathered;
    }
    if (old.tool !== snapshot.tool) this.updateTool();
    if (old.timeOfDay !== snapshot.timeOfDay) this.setLighting(snapshot.timeOfDay);
    const ids = new Set(snapshot.decorations.map(d => d.id));
    for (const [id, g] of this.decorationMeshes) if (!ids.has(id)) { this.disposeObject(g); this.root.remove(g); this.decorationMeshes.delete(id); }
    for (const decoration of snapshot.decorations) if (!this.decorationMeshes.has(decoration.id)) this.addDecoration(decoration);
  }

  private addDecoration(decoration: Decoration) {
    let g: THREE.Group;
    if (decoration.kind === 'bench') g = this.buildBench(decoration.x, decoration.z, .4);
    else if (decoration.kind === 'lantern') g = this.buildLamp(decoration.x, decoration.z);
    else { g = new THREE.Group(); g.position.set(decoration.x, GROUND, decoration.z); this.root.add(g); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; this.flower(g, Math.cos(a) * .36, .02, Math.sin(a) * .36, i % 2 ? 0xffdb98 : 0xf1a092, 1.05); } }
    this.decorationMeshes.set(decoration.id, g);
  }

  private setLighting(time: SceneSnapshot['timeOfDay']) {
    const isNight = time === 'night', sunset = time === 'sunset';
    const sea = isNight ? 0x668f9e : sunset ? 0xb7ccc1 : COLORS.sea;
    this.oceanMaterial.color.set(sea);
    this.scene.background = new THREE.Color(this.location === 'home' ? 0xdcccad : isNight ? 0x5c718a : sunset ? 0xe7c5b0 : 0xc2e4ed); if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(sea);
    this.ambient.intensity = isNight ? 1.05 : sunset ? 1.5 : 1.75;
    this.ambient.color.set(isNight ? 0xb9cce7 : sunset ? 0xffe1c0 : 0xfff7dc);
    this.sunlight.intensity = isNight ? .55 : sunset ? 1.9 : 2.2;
    this.sunlight.color.set(isNight ? 0xb8cce7 : sunset ? 0xffba86 : 0xfff2db);
    this.sunlight.position.set(sunset ? -27 : -15, sunset ? 15 : 30, 14);
    this.renderer.toneMappingExposure = isNight ? .75 : .9;
    this.lanternLights.forEach(l => { (l.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 3 : sunset ? 1.5 : .25; });
    this.fireflies.forEach(f => { f.visible = isNight; });
  }

  setPlayer(position: Position) {
    const x = Number.isFinite(position.x) ? position.x : PLAYER_START.x;
    const z = Number.isFinite(position.z) ? position.z : PLAYER_START.z;
    this.outdoorPosition = { x, z };
    if (this.location === 'island') { this.player.position.set(x, GROUND, z); this.cameraTarget.set(x, 1, z - .7); }
    this.waypoint = null; this.route = []; this.targetEntity = null;
  }

  getPlayerPosition(): Position { return { x: this.player.position.x, z: this.player.position.z }; }

  getFurniturePosition(kind: FurnitureKind): Position | null {
    return this.location === 'home' ? this.interior.getPlacement(kind, this.getPlayerPosition()) : null;
  }

  private switchLocation(location: 'island' | 'home') {
    if (location === 'home') {
      this.outdoorPosition = this.getPlayerPosition();
      this.player.position.set(0, GROUND, (this.snapshot.homeLevel ?? 0) > 0 ? 3.4 : 2.4); this.player.rotation.y = Math.PI;
    } else {
      this.player.position.set(this.outdoorPosition.x, GROUND, this.outdoorPosition.z); this.player.rotation.y = 0;
    }
    this.location = location;
    this.root.visible = location === 'island'; this.interior.group.visible = location === 'home';
    this.keys.clear(); this.waypoint = null; this.route = []; this.targetEntity = null; this.action = null;
    this.clearFishing(); this.clearPresentation();
    this.near = null; this.options.onNear(null);
    this.cameraTarget.copy(location === 'home' ? new THREE.Vector3(0, .8, 0) : new THREE.Vector3(this.player.position.x, 1, this.player.position.z - .7));
    this.toolGroup.visible = location === 'island';
    this.setLighting(this.snapshot.timeOfDay); this.resize(); this.updateCamera(1);
    if (location === 'island' && this.pendingVisit) { const id = this.pendingVisit; this.pendingVisit = null; this.visit(id); }
  }

  getDecorationPosition(): Position | null {
    if (this.location === 'home') return null;
    const p = this.player.position;
    for (const radius of [1.8, 2.35, 2.9, 3.5, 4.1]) {
      for (let i = 0; i < 16; i++) {
        const angle = this.player.rotation.y + i / 16 * Math.PI * 2;
        const x = p.x + Math.sin(angle) * radius, z = p.z + Math.cos(angle) * radius;
        if (x * x / 197 + (z + .8) * (z + .8) / 108 > .9 || this.riverDistance(x, z) < 1.8) continue;
        if (![[0, 0], [-.65, -.65], [-.65, .65], [.65, -.65], [.65, .65]].every(([ox, oz]) => this.canWalk(x + ox, z + oz))) continue;
        if (this.snapshot.decorations.some(d => Math.hypot(d.x - x, d.z - z) < 2)) continue;
        if ([[4.2, 3, 1.6], [-.3, -4.5, 2.5], [-5.5, 7, 2.1], [-2.55, 3.35, .8], [3.1, 10.3, .8]].some(([sx, sz, clearance]) => Math.hypot(x - sx, z - sz) < clearance)) continue;
        return { x, z };
      }
    }
    return null;
  }

  setCamera(view: 'close' | 'normal' | 'wide') { this.cameraView = view; this.resize(); }

  /** Queue a visit so panel dismissal always happens before the interaction. */
  visit(entityId: string): void {
    const outdoor = this.entities.get(entityId)?.entity;
    if (outdoor && this.location === 'home') { this.pendingVisit = entityId; return; }
    const bed = this.location === 'home' ? this.snapshot.room?.find(piece => piece.id === entityId && piece.kind === 'bed') : undefined;
    const entity = outdoor ? this.liveEntity(outdoor)
      : entityId === 'home-exit' && this.location === 'home' ? this.exitEntity()
      : bed ? { id: bed.id, kind: 'bed' as const, name: 'Rest in your bed', x: bed.x, z: bed.z } : null;
    if (!entity) return;
    this.pendingVisit = null;
    this.waypoint = new THREE.Vector2(entity.x, entity.z); this.targetEntity = entity;
    this.route = this.findPath(entity.x, entity.z, this.reach(entity) - .25);
    this.waypointRing.position.set(entity.x, GROUND + .075, entity.z);
    this.waypointRing.visible = !this.snapshot.paused;
  }

  setWaypoint(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.location === 'home') { const upgraded = (this.snapshot.homeLevel ?? 0) > 0; x = THREE.MathUtils.clamp(x, upgraded ? -4.5 : -3.5, upgraded ? 4.5 : 3.5); z = THREE.MathUtils.clamp(z, upgraded ? -4 : -3, upgraded ? 4 : 3); }
    else { const factor = Math.sqrt(x * x / (16.7 * 16.7) + (z + .8) * (z + .8) / (13 * 13)); if (factor > 1) { x /= factor; z = (z + .8) / factor - .8; } }
    this.waypoint = new THREE.Vector2(x, z); this.targetEntity = null;
    this.route = this.findPath(x, z);
    this.waypointRing.position.set(x, GROUND + .075, z); this.waypointRing.visible = true;
  }

  interact() {
    if (this.snapshot.paused) return;
    this.updateNear();
    if (this.near) this.dispatchInteraction(this.near);
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (this.snapshot.paused || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', ' '].includes(key)) {
      event.preventDefault();
      if (key === 'e' || key === ' ') { if (!event.repeat) this.interact(); }
      else { this.keys.add(key); this.waypoint = null; this.route = []; this.targetEntity = null; }
    }
  };
  private readonly keyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private readonly blur = () => { this.keys.clear(); };
  private readonly pointerDown = (event: PointerEvent) => { this.pointerStart = { x: event.clientX, y: event.clientY }; };
  private setRay(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  private readonly pointerMove = (event: PointerEvent) => {
    if (this.snapshot.paused) return;
    this.setRay(event);
    const targets = this.location === 'home' ? this.interior.group.children : this.entityMeshes;
    const hit = this.raycaster.intersectObjects(targets, this.location === 'home').find(h => this.isVisible(h.object) && (this.location !== 'home' || h.object.userData.furnitureId));
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
  };
  private readonly pointerUp = (event: PointerEvent) => {
    if (this.snapshot.paused || this.action || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 7 || event.button !== 0) return;
    this.setRay(event);
    if (this.location === 'home') {
      const hit = this.raycaster.intersectObjects(this.interior.group.children, true).find(h => h.object.userData.furnitureId && this.isVisible(h.object));
      if (hit) { this.options.onFurnitureSelect?.(String(hit.object.userData.furnitureId)); return; }
    } else {
      const hit = this.raycaster.intersectObjects(this.entityMeshes, false).find(h => this.isVisible(h.object));
      const base = hit ? this.entities.get(hit.object.userData.entityId as string)?.entity : undefined;
      if (base) { this.approachEntity(this.liveEntity(base)); return; }
    }
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND); const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(ground, p)) {
      if (this.location === 'home' && Math.abs(p.x) < .8 && p.z > ((this.snapshot.homeLevel ?? 0) > 0 ? 3.5 : 2.5)) this.approachEntity(this.exitEntity());
      else this.setWaypoint(p.x, p.z);
    }
  };
  private approachEntity(entity: WorldEntity) {
    const distance = Math.hypot(entity.x - this.player.position.x, entity.z - this.player.position.z);
    if (distance <= this.reach(entity)) { this.dispatchInteraction(entity); return; }
    this.waypoint = new THREE.Vector2(entity.x, entity.z); this.targetEntity = entity;
    this.route = this.findPath(entity.x, entity.z, this.reach(entity) - .25);
    this.waypointRing.position.set(entity.x, GROUND + .075, entity.z); this.waypointRing.visible = true;
  }
  private isVisible(obj: THREE.Object3D) { let p: THREE.Object3D | null = obj; while (p) { if (!p.visible) return false; p = p.parent; } return true; }
  private reach(entity: WorldEntity) { return entity.kind === 'home' ? 1.55 : entity.kind === 'shop' ? 2 : entity.kind === 'fish' ? 2.6 : entity.kind === 'bed' ? 1.8 : entity.kind === 'exit' ? 1.05 : entity.kind === 'shell' ? 1.35 : 1.85; }
  private liveEntity(entity: WorldEntity): WorldEntity {
    if (entity.kind === 'home') return { ...entity, x: entity.x + .3, z: entity.z + 2.55 };
    if (entity.kind === 'shop') return { ...entity, z: entity.z + 1.4 };
    const rendered = this.entities.get(entity.id);
    return rendered && ['villager', 'butterfly', 'fish'].includes(entity.kind) ? { ...entity, x: rendered.group.position.x, z: rendered.group.position.z } : entity;
  }
  private exitEntity(): WorldEntity { return { id: 'home-exit', kind: 'exit', name: 'Go outside', x: 0, z: (this.snapshot.homeLevel ?? 0) > 0 ? 4.05 : 3.05 }; }
  private dispatchInteraction(entity: WorldEntity) {
    const dx = entity.x - this.player.position.x, dz = entity.z - this.player.position.z;
    if (Math.hypot(dx, dz) > .01) this.player.rotation.y = Math.atan2(dx, dz);
    if (entity.kind === 'exit' && this.options.onExitHome) this.options.onExitHome();
    else this.options.onInteract(entity);
  }
  private updateNear() {
    let nearest: WorldEntity | null = null, nearestDistance = Infinity;
    const candidates = this.location === 'home'
      ? [this.exitEntity(), ...(this.snapshot.room ?? []).filter(f => f.kind === 'bed').map(f => ({ id: f.id, kind: 'bed' as const, name: 'Rest in your bed', x: f.x, z: f.z }))]
      : [...this.entities.values()].filter(r => r.group.visible).map(r => this.liveEntity(r.entity));
    for (const entity of candidates) {
      const distance = Math.hypot(entity.x - this.player.position.x, entity.z - this.player.position.z);
      if (distance < this.reach(entity) && distance < nearestDistance) { nearest = entity; nearestDistance = distance; }
    }
    const changed = this.near?.id !== nearest?.id;
    this.near = nearest; if (changed) this.options.onNear(nearest);
    this.selection.visible = !!nearest && !this.snapshot.paused && !this.action;
    if (nearest) this.selection.position.set(nearest.x, nearest.kind === 'shell' ? .21 : GROUND + .085, nearest.z);
  }

  private riverDistance(x: number, z: number) {
    let min = Infinity;
    for (let i = 1; i < RIVER.length; i++) { const a = RIVER[i - 1], b = RIVER[i]; const dx = b.x - a.x, dz = b.y - a.y; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz))); min = Math.min(min, Math.hypot(x - a.x - t * dx, z - a.y - t * dz)); }
    return min;
  }

  private canWalk(x: number, z: number) {
    if (this.location === 'home') return !this.interior.collides(x, z);
    const onDock = Math.abs(x - 1.15) < 1 && z >= 10.8 && z < 15.7;
    if (!onDock && x * x / (16.75 * 16.75) + (z + .8) * (z + .8) / (13.15 * 13.15) > 1) return false;
    const onBridge = Math.abs(z + 3.45) < .75 && x > 4.8 && x < 9;
    if (!onBridge && this.riverDistance(x, z) < 1.04) return false;
    for (const e of WORLD_ENTITIES) {
      if (e.kind === 'home' && Math.abs(x - e.x) < 2.65 && Math.abs(z - e.z) < 2.18) return false;
      if (e.kind === 'shop' && Math.abs(x - e.x) < 1.6 && Math.abs(z - e.z) < 1.13) return false;
      if ((e.kind === 'tree' || e.kind === 'rock') && Math.hypot(x - e.x, z - e.z) < (e.kind === 'tree' ? .55 : .85)) return false;
    }
    for (const d of this.snapshot.decorations) if (d.kind !== 'flowers' && Math.hypot(x - d.x, z - d.z) < (d.kind === 'bench' ? 1 : .42)) return false;
    return true;
  }

  /** A small navigation grid keeps click-to-walk routes on land and over the bridge. */
  private findPath(targetX: number, targetZ: number, reach = 0): THREE.Vector2[] {
    const indoors = this.location === 'home';
    const step = indoors ? .35 : .55, columns = indoors ? 33 : 65, rows = indoors ? 31 : 58, offsetX = indoors ? -5.6 : -17.6, offsetZ = indoors ? -5.25 : -15.4;
    const point = (id: number) => new THREE.Vector2(offsetX + (id % columns) * step, offsetZ + Math.floor(id / columns) * step);
    const walkable = new Uint8Array(columns * rows);
    let start = -1, startDistance = Infinity, goal = -1, goalScore = Infinity;
    for (let id = 0; id < walkable.length; id++) {
      const p = point(id);
      if (!this.canWalk(p.x, p.y)) continue;
      walkable[id] = 1;
      const fromPlayer = Math.hypot(p.x - this.player.position.x, p.y - this.player.position.z);
      if (fromPlayer < startDistance) { start = id; startDistance = fromPlayer; }
      const fromTarget = Math.hypot(p.x - targetX, p.y - targetZ);
      const score = reach > 0 ? (fromTarget <= reach ? fromPlayer : 1000 + fromTarget) : fromTarget;
      if (score < goalScore) { goal = id; goalScore = score; }
    }
    if (start < 0 || goal < 0) return [];
    const costs = new Float64Array(walkable.length).fill(Infinity);
    const previous = new Int32Array(walkable.length).fill(-1);
    const closed = new Uint8Array(walkable.length);
    const open = new Set<number>([start]); costs[start] = 0;
    const goalPoint = point(goal);
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    while (open.size) {
      let current = -1, best = Infinity;
      for (const id of open) { const p = point(id); const score = costs[id] + p.distanceTo(goalPoint); if (score < best) { current = id; best = score; } }
      if (current === goal) break;
      open.delete(current); closed[current] = 1;
      const cx = current % columns, cz = Math.floor(current / columns);
      for (const [ox, oz] of neighbors) {
        const nx = cx + ox, nz = cz + oz;
        if (nx < 0 || nz < 0 || nx >= columns || nz >= rows) continue;
        const next = nz * columns + nx;
        if (!walkable[next] || closed[next]) continue;
        if (ox && oz && (!walkable[cz * columns + nx] || !walkable[nz * columns + cx])) continue;
        const cost = costs[current] + step * (ox && oz ? Math.SQRT2 : 1);
        if (cost >= costs[next]) continue;
        costs[next] = cost; previous[next] = current; open.add(next);
      }
    }
    if (goal !== start && previous[goal] < 0) return [];
    const path: THREE.Vector2[] = [];
    for (let id = goal; id !== start && id >= 0; id = previous[id]) path.unshift(point(id));
    if (!reach && this.canWalk(targetX, targetZ)) path.push(new THREE.Vector2(targetX, targetZ));
    // Remove unnecessary grid turns, preserving obstacle and creek clearance.
    const smooth: THREE.Vector2[] = [];
    let from = new THREE.Vector2(this.player.position.x, this.player.position.z), at = 0;
    while (at < path.length) {
      let last = at;
      for (let i = at + 1; i < path.length; i++) {
        const distance = from.distanceTo(path[i]); let clear = true;
        for (let t = .15; t < distance; t += .15) { const p = from.clone().lerp(path[i], t / distance); if (!this.canWalk(p.x, p.y)) { clear = false; break; } }
        if (!clear) break;
        last = i;
      }
      smooth.push(path[last]); from = path[last]; at = last + 1;
    }
    return smooth;
  }

  private reportMove() {
    if (this.location !== 'island') return;
    this.outdoorPosition = this.getPlayerPosition(); this.options.onMove(this.outdoorPosition);
  }

  private updateCamera(dt: number) {
    const desired = this.location === 'home' ? new THREE.Vector3(0, .9, 0) : new THREE.Vector3(this.player.position.x, 1.1, this.player.position.z - .75);
    this.cameraTarget.lerp(desired, 1 - Math.exp(-dt * 5.5));
    const offset = new THREE.Vector3(0, 10, 14);
    this.camera.position.copy(this.cameraTarget).add(offset); this.camera.lookAt(this.cameraTarget);
    const desiredZoom = this.action?.kind === 'catch' ? 1.13 : 1;
    this.camera.zoom += (desiredZoom - this.camera.zoom) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    const obscuring = new Set<THREE.MeshStandardMaterial>();
    if (this.location === 'island') {
      const playerScreen = this.player.position.clone().add(new THREE.Vector3(0, 1.1, 0)).project(this.camera);
      for (const canopy of this.trees) {
        const world = new THREE.Vector3(); canopy.getWorldPosition(world); world.y += 2.8;
        if (world.z < this.player.position.z + .5) continue;
        const screen = world.project(this.camera);
        if (Math.abs(screen.x - playerScreen.x) < .17 && Math.abs(screen.y - playerScreen.y) < .33) canopy.traverse(obj => {
          if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) obscuring.add(obj.material);
        });
      }
    }
    for (const mat of obscuring) { if (!this.fadedMaterials.has(mat)) this.fadedMaterials.set(mat, mat.opacity); mat.transparent = true; mat.depthWrite = false; mat.opacity += (.24 - mat.opacity) * Math.min(1, dt * 9); }
    for (const [mat, original] of this.fadedMaterials) if (!obscuring.has(mat)) {
      mat.opacity += (original - mat.opacity) * Math.min(1, dt * 9);
      if (Math.abs(mat.opacity - original) < .01) { mat.opacity = original; mat.depthWrite = true; mat.transparent = original < 1; this.fadedMaterials.delete(mat); }
    }
  }

  private updateVillagers(dt: number) {
    if (this.location !== 'island') return;
    for (const rendered of this.entities.values()) {
      const { entity, group, legs } = rendered;
      if (entity.kind !== 'villager') continue;
      const distance = Math.hypot(group.position.x - this.player.position.x, group.position.z - this.player.position.z);
      const approached = distance < 2.6 || this.targetEntity?.id === entity.id;
      let walking = false;
      if (!this.snapshot.paused && !approached) {
        if (!rendered.roamTarget && (rendered.idleUntil ?? 0) < this.elapsed) {
          const seed = Math.floor(this.elapsed / 3) + entity.x * 9;
          for (let i = 0; i < 8; i++) {
            const a = random(seed + i * 87) * Math.PI * 2, radius = .65 + random(seed + i + 83) * 2.6;
            const x = entity.x + Math.cos(a) * radius, z = entity.z + Math.sin(a) * radius;
            if (this.canWalk(x, z) && this.riverDistance(x, z) > 1.3) { rendered.roamTarget = new THREE.Vector2(x, z); break; }
          }
          rendered.idleUntil = this.elapsed + 3;
        }
        if (rendered.roamTarget) {
          const dx = rendered.roamTarget.x - group.position.x, dz = rendered.roamTarget.y - group.position.z, length = Math.hypot(dx, dz);
          if (length < .13) { rendered.roamTarget = undefined; rendered.idleUntil = this.elapsed + 2 + random(entity.x + this.elapsed) * 4; }
          else {
            const x = group.position.x + dx / length * dt * .68, z = group.position.z + dz / length * dt * .68;
            if (this.canWalk(x, z)) { group.position.x = x; group.position.z = z; walking = true; this.turnToward(group, Math.atan2(dx, dz), dt * 5); }
            else { rendered.roamTarget = undefined; rendered.idleUntil = this.elapsed + 2; }
          }
        }
      } else if (approached) this.turnToward(group, Math.atan2(this.player.position.x - group.position.x, this.player.position.z - group.position.z), dt * 3);
      group.position.y = GROUND + (walking ? Math.abs(Math.sin(this.elapsed * 7)) * .055 : Math.sin(this.elapsed * 2 + entity.x) * .014);
      legs?.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(this.elapsed * 7 + i * Math.PI) * .52 : 0; });
    }
  }

  private turnToward(object: THREE.Object3D, angle: number, amount: number) {
    let delta = angle - object.rotation.y; while (delta > Math.PI) delta -= Math.PI * 2; while (delta < -Math.PI) delta += Math.PI * 2;
    object.rotation.y += delta * Math.min(1, amount);
  }

  playAction(kind: ActionKind, entity?: WorldEntity): void {
    this.keys.clear(); this.waypoint = null; this.route = []; this.targetEntity = null;
    this.clearPresentation();
    const duration = kind === 'catch' ? 4 : kind === 'bite' ? 1.9 : kind === 'cast' ? .85 : kind === 'net' ? .9 : 1.1;
    this.action = { kind, entity, started: this.elapsed, duration };
    this.selection.visible = false;
    if (entity && kind !== 'catch') this.player.rotation.y = Math.atan2(entity.x - this.player.position.x, entity.z - this.player.position.z);
    if (kind === 'shake' && entity) { const tree = this.entities.get(entity.id); if (tree) tree.group.userData.shakeUntil = this.elapsed + 1; }
    if (kind === 'cast') {
      this.clearFishing();
      const x = entity?.x ?? this.player.position.x + Math.sin(this.player.rotation.y) * 2.5;
      const z = entity?.z ?? this.player.position.z + Math.cos(this.player.rotation.y) * 2.5;
      this.bobber = new THREE.Group(); this.bobber.position.set(x, GROUND + .05, z); this.actors.add(this.bobber);
      ball(this.bobber, .1, 0xf8f2cf, 0, .04, 0); ball(this.bobber, .077, 0xd55b4a, 0, .11, 0);
      cylinder(this.bobber, .018, .018, .24, 0xd65b47, 0, .21, 0, 8);
      for (let i = 0; i < 3; i++) { const ring = mesh(new THREE.RingGeometry(.18 + i * .2, .2 + i * .2, 48), new THREE.MeshBasicMaterial({ color: 0xe6fff5, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }), this.bobber, 0, .001, 0); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; }
      this.fishingLine = line(this.actors, [this.player.position.clone(), this.bobber.position.clone()], 0xf6f0d8, .9);
      this.spawnSparkles(new THREE.Vector3(x, GROUND + .05, z), 0xd7f1e2, 8, .55);
    }
    if (kind === 'bite' && this.bobber) {
      const g = new THREE.Group(); g.position.copy(this.bobber.position).add(new THREE.Vector3(0, .9, 0)); this.presentation.add(g);
      cylinder(g, .072, .055, .37, 0xffe39a, 0, .2, 0, 12); ball(g, .073, 0xffe39a, 0, -.09, 0);
      this.spawnSparkles(this.bobber.position, 0xf0fff8, 14, .9);
    }
    if (kind === 'catch') {
      this.clearFishing(); this.player.rotation.y = this.location === 'home' ? .35 : 0;
      this.buildHeldCatch(entity?.kind === 'butterfly' ? 'butterfly' : 'fish');
      this.spawnSparkles(this.player.position.clone().add(new THREE.Vector3(0, 2.5, .3)), 0xffe7a0, 20, 1.5);
    }
    if (kind === 'dig' || kind === 'pickup' || kind === 'shake') {
      const position = entity ? new THREE.Vector3(entity.x, GROUND + .3, entity.z) : this.player.position.clone();
      this.spawnSparkles(position, kind === 'dig' ? 0xcdb88c : 0xffdf8d, 10, .7);
    }
    if (kind === 'net') this.spawnSparkles(this.player.position.clone().add(new THREE.Vector3(Math.sin(this.player.rotation.y), 1.5, Math.cos(this.player.rotation.y))), 0xfbf1b5, 8, .7);
  }

  private buildHeldCatch(kind: 'fish' | 'butterfly') {
    const g = new THREE.Group(); g.position.copy(this.player.position).add(new THREE.Vector3(0, 2.7, .28)); this.presentation.add(g); g.userData.held = true;
    if (kind === 'fish') {
      const body = ball(g, .31, 0x75a996, 0, 0, 0, 2); body.scale.set(1.6, .83, .64);
      const belly = ball(g, .25, 0xdde1b3, 0, -.1, .065, 2); belly.scale.set(1.52, .56, .63);
      const tail = mesh(new THREE.ConeGeometry(.27, .34, 3), material(0x568f85), g, -.58, 0, 0); tail.rotation.z = -Math.PI / 2; tail.scale.z = .4;
      const fin = mesh(new THREE.ConeGeometry(.17, .27, 3), material(0x659c8b), g, -.01, .25, 0); fin.scale.z = .32;
      ball(g, .073, 0xfdf9dc, .31, .065, .154); ball(g, .043, 0x354d43, .34, .065, .21);
      const mouth = mesh(new THREE.TorusGeometry(.047, .014, 6, 16), material(0x4d8071), g, .48, -.015, .05); mouth.rotation.y = Math.PI / 2;
    } else {
      const wings = this.buildButterfly(g, 0xf0cf61); g.scale.setScalar(1.7); g.position.y -= 1.85;
      wings.forEach((wing, i) => { wing.rotation.z = i ? -.28 : .28; });
      const hoop = mesh(new THREE.TorusGeometry(.18, .014, 6, 20), material(0x86b698), g, 0, 1.03, 0); hoop.rotation.x = Math.PI / 2;
    }
  }

  private clearPresentation() { for (const child of [...this.presentation.children]) { this.disposeObject(child); child.removeFromParent(); } }
  private clearFishing() {
    if (this.bobber) { this.disposeObject(this.bobber); this.bobber.removeFromParent(); this.bobber = null; }
    if (this.fishingLine) { this.disposeObject(this.fishingLine); this.fishingLine.removeFromParent(); this.fishingLine = null; }
  }

  private updateAction(dt: number) {
    if (this.bobber) {
      this.bobber.position.y = GROUND + .06 + Math.sin(this.elapsed * (this.action?.kind === 'bite' ? 16 : 3)) * (this.action?.kind === 'bite' ? .065 : .022);
      const dx = Math.sin(this.player.rotation.y), dz = Math.cos(this.player.rotation.y);
      const start = this.player.position.clone().add(new THREE.Vector3(dx * .8 + .25, 1.94, dz * .8));
      const end = this.bobber.position.clone().add(new THREE.Vector3(0, .08, 0));
      const midpoint = start.clone().lerp(end, .5); midpoint.y -= .27;
      const points = new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(16);
      if (this.fishingLine) { this.fishingLine.geometry.dispose(); this.fishingLine.geometry = new THREE.BufferGeometry().setFromPoints(points); }
      if (!this.action) this.playerArms[1].rotation.x = -.78;
    }
    if (!this.action) return;
    const { kind, started, duration } = this.action, t = Math.min(1, (this.elapsed - started) / duration);
    this.playerLegs.forEach(leg => { leg.rotation.x = 0; });
    this.toolGroup.visible = kind !== 'catch' && this.location === 'island';
    if (kind === 'catch') {
      this.playerArms.forEach((arm, i) => { arm.rotation.x = -2.45; arm.rotation.z = i ? -.24 : .24; });
      this.player.position.y = GROUND + Math.sin(t * Math.PI) * .045;
      for (const child of this.presentation.children) if (child.userData.held) child.rotation.z = Math.sin(this.elapsed * 2) * .035;
    } else if (kind === 'net') {
      this.playerArms[1].rotation.x = -1.7 * Math.sin(t * Math.PI); this.playerArms[1].rotation.z = -.3 * Math.sin(t * Math.PI);
    } else if (kind === 'cast') this.playerArms[1].rotation.x = -.8 - Math.sin(t * Math.PI) * 1.3;
    else if (kind === 'bite') this.playerArms[1].rotation.x = -.8 + Math.sin(t * 22) * .08;
    else if (kind === 'dig') { this.player.rotation.x = Math.sin(t * Math.PI) * .17; this.playerArms[1].rotation.x = -Math.sin(t * Math.PI) * 1.45; }
    else if (kind === 'pickup') { this.player.rotation.x = Math.sin(t * Math.PI) * .35; this.playerArms[1].rotation.x = -Math.sin(t * Math.PI) * .9; }
    else if (kind === 'shake') this.playerArms.forEach(arm => { arm.rotation.x = -1.15 + Math.sin(t * 24) * .24; });
    if (t >= 1) {
      this.action = null; this.player.rotation.x = 0;
      this.playerArms.forEach(arm => { arm.rotation.set(0, 0, 0); });
      this.toolGroup.visible = this.location === 'island'; this.clearPresentation();
    }
  }

  private spawnSparkles(position: THREE.Vector3, color: number, count: number, life: number) {
    for (let i = 0; i < count; i++) {
      const a = random(i + this.elapsed * 80) * Math.PI * 2;
      const object = ball(this.actors, .03 + random(i + 45) * .035, material(color, { transparent: true, opacity: .9, emissive: color, emissiveIntensity: .15, depthWrite: false }), position.x, position.y, position.z, 0);
      object.castShadow = false;
      this.particles.push({ mesh: object, velocity: new THREE.Vector3(Math.cos(a) * (.3 + random(i) * 1.2), .5 + random(i + 39) * 1.2, Math.sin(a) * (.3 + random(i + 71))), age: 0, life: life * (.7 + random(i + 24) * .6) });
    }
  }
  private spawnDust() {
    for (let i = 0; i < 2; i++) {
      const object = ball(this.actors, .065, material(0xf1e8bb, { transparent: true, opacity: .32, depthWrite: false }), this.player.position.x + (random(this.elapsed + i) - .5) * .3, this.player.position.y + .05, this.player.position.z, 1);
      object.castShadow = false;
      this.particles.push({ mesh: object, velocity: new THREE.Vector3((random(i + this.elapsed) - .5) * .2, .2, .05), age: 0, life: .45 });
    }
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.age += dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * .7;
      p.mesh.scale.setScalar(.7 + p.age / p.life); (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, (1 - p.age / p.life) * .8);
      if (p.age >= p.life) { p.mesh.removeFromParent(); this.disposeObject(p.mesh); this.particles.splice(i, 1); }
    }
  }

  private movePlayer(dt: number) {
    if (this.snapshot.paused || this.action) {
      if (this.moving) this.reportMove(); this.moving = false; this.waypointRing.visible = false; this.selection.visible = false;
      this.playerLegs.forEach(leg => { leg.rotation.x *= Math.max(0, 1 - dt * 10); });
      if (!this.action) this.playerArms.forEach(arm => { arm.rotation.x *= Math.max(0, 1 - dt * 10); });
      return;
    }
    let dx = 0, dz = 0;
    const forward = new THREE.Vector3(); this.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    if (this.keys.has('w') || this.keys.has('arrowup')) { dx += forward.x; dz += forward.z; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { dx -= forward.x; dz -= forward.z; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { dx -= right.x; dz -= right.z; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { dx += right.x; dz += right.z; }
    if (this.waypoint) {
      if (this.targetEntity && ['villager', 'butterfly', 'fish'].includes(this.targetEntity.kind)) this.targetEntity = this.liveEntity(this.targetEntity);
      if (this.targetEntity && Math.hypot(this.targetEntity.x - this.player.position.x, this.targetEntity.z - this.player.position.z) < this.reach(this.targetEntity) - .08) {
        const e = this.targetEntity; this.targetEntity = null; this.waypoint = null; this.route = []; this.dispatchInteraction(e);
      } else {
        while (this.route.length && Math.hypot(this.route[0].x - this.player.position.x, this.route[0].y - this.player.position.z) < .18) this.route.shift();
        const step = this.route[0];
        if (step) { dx = step.x - this.player.position.x; dz = step.y - this.player.position.z; }
        else { this.waypoint = null; this.targetEntity = null; }
      }
    }
    const length = Math.hypot(dx, dz); const wasMoving = this.moving; this.moving = length > .01;
    if (this.moving) {
      dx = dx / length * dt * 4.2; dz = dz / length * dt * 4.2;
      const p = this.player.position; const startX = p.x, startZ = p.z;
      if (this.canWalk(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
      else { if (this.canWalk(p.x + dx, p.z)) p.x += dx; if (this.canWalk(p.x, p.z + dz)) p.z += dz; }
      this.moving = Math.hypot(p.x - startX, p.z - startZ) > .001;
      if (!this.moving && this.waypoint) {
        // A short tangent step avoids trunks and rocks on click-to-walk journeys.
        for (const angle of [.7, -.7, 1.2, -1.2]) { const tx = dx * Math.cos(angle) - dz * Math.sin(angle), tz = dx * Math.sin(angle) + dz * Math.cos(angle); if (this.canWalk(p.x + tx, p.z + tz)) { p.x += tx; p.z += tz; this.moving = true; break; } }
      }
      const desired = Math.atan2(dx, dz); let delta = desired - this.player.rotation.y; while (delta > Math.PI) delta -= Math.PI * 2; while (delta < -Math.PI) delta += Math.PI * 2; this.player.rotation.y += delta * Math.min(dt * 12, 1);
      if (this.elapsed - this.lastMove > .2) { this.reportMove(); this.lastMove = this.elapsed; }
    }
    if (wasMoving && !this.moving) this.reportMove();
    const shore = this.player.position.x ** 2 / 215 + (this.player.position.z + .8) ** 2 / 136 > 1;
    const onBridge = Math.abs(this.player.position.z + 3.45) < .9 && this.player.position.x > 5.05 && this.player.position.x < 8.65;
    let height = this.location === 'home' ? GROUND : shore ? .17 : GROUND;
    if (onBridge && this.location === 'island') height = GROUND + .16 + Math.max(0, Math.cos((this.player.position.x - 6.85) / 1.8 * Math.PI / 2)) * .29;
    this.player.position.y = height + (this.moving ? Math.abs(Math.sin(this.elapsed * 12)) * .06 : Math.sin(this.elapsed * 2.2) * .012);
    this.playerLegs.forEach((leg, i) => { leg.rotation.x = this.moving ? Math.sin(this.elapsed * 12 + i * Math.PI) * .6 : 0; });
    this.playerArms.forEach((arm, i) => { arm.rotation.x = this.moving ? Math.sin(this.elapsed * 12 + i * Math.PI + Math.PI) * .43 : Math.sin(this.elapsed * 2 + i) * .025; });
    this.waypointRing.visible = !!this.waypoint;
    this.updateNear();
    if (this.moving && this.location === 'island' && this.elapsed - this.lastFootstep > .25) { this.lastFootstep = this.elapsed; this.spawnDust(); }
  }

  private readonly animate = () => {
    if (this.destroyed) return;
    const dt = Math.min(this.clock.getDelta(), .05); this.elapsed += dt;
    this.updateVillagers(dt);
    this.movePlayer(dt);
    this.updateAction(dt);
    this.updateCamera(dt);
    this.updateParticles(dt);
    this.waterLines.forEach((wave, i) => { wave.position.x = Math.sin(this.elapsed * .5 + i * 1.7) * .15; (wave.material as THREE.LineBasicMaterial).opacity = .3 + Math.sin(this.elapsed * .8 + i) * .14; });
    this.trees.forEach((tree, i) => { tree.rotation.z = Math.sin(this.elapsed * .8 + i * .9) * .011; tree.rotation.x = Math.sin(this.elapsed * .6 + i) * .007; });
    this.smoke.forEach((puff, i) => { const t = (this.elapsed * .25 + i * .26) % 1; puff.position.y = 5.15 + t * 2.2; puff.position.x = 1.28 + t * .65; puff.scale.setScalar(.6 + t * 1.3); (puff.material as THREE.MeshStandardMaterial).opacity = .35 * (1 - t); });
    for (const { entity, group, wings } of this.entities.values()) {
      if (entity.kind === 'tree') group.rotation.z = group.userData.shakeUntil > this.elapsed ? Math.sin(this.elapsed * 30) * .045 : 0;
      if (entity.kind === 'butterfly') { group.position.x = entity.x + Math.sin(this.elapsed * .85 + entity.x) * .32; group.position.z = entity.z + Math.cos(this.elapsed * .65 + entity.z) * .3; group.position.y = GROUND + Math.sin(this.elapsed * 2.1) * .18; wings?.forEach((wing, i) => { wing.rotation.z = Math.sin(this.elapsed * 13) * 1.05 * (i ? 1 : -1); }); group.rotation.y = Math.sin(this.elapsed * .65) * .4; }

      if (entity.kind === 'fish') { group.rotation.y = Math.sin(this.elapsed * .45 + entity.x) * .5; group.position.z = entity.z + Math.sin(this.elapsed * .6) * .12; }
    }
    this.fireflies.forEach((f, i) => { if (f.visible) { f.position.y = 1.7 + Math.sin(this.elapsed * 1.1 + i) * .7; f.scale.setScalar(.65 + Math.sin(this.elapsed * 2 + i) * .35); } });
    this.selection.scale.setScalar(1 + Math.sin(this.elapsed * 3) * .035);
    this.waypointRing.scale.setScalar(1 + Math.sin(this.elapsed * 4) * .14);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private disposeObject(object: THREE.Object3D) {
    object.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) { if (mat instanceof THREE.MeshStandardMaterial && mat.map) mat.map.dispose(); mat.dispose(); }
      }
    });
  }

  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.blur);
    this.renderer.domElement.removeEventListener('pointerdown', this.pointerDown); this.renderer.domElement.removeEventListener('pointerup', this.pointerUp); this.renderer.domElement.removeEventListener('pointermove', this.pointerMove);
    this.interior.group.removeFromParent(); this.interior.dispose();
    this.disposeObject(this.scene); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
