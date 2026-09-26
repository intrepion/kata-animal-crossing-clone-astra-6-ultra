import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Backpack,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  DoorOpen,
  Flower2,
  Hammer,
  Heart,
  House,
  Leaf,
  Map,
  Moon,
  RotateCcw,
  RotateCw,
  Settings,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar, LeafMark, ToolIcon } from "./Icons";
import ItemArt from "./components/ItemArt";
import IslandMap from "./components/IslandMap";
import DialogueBox from "./components/DialogueBox";
import { chime, setAmbient } from "./audio";
import { IslandScene } from "./game/scene";
import { WORLD_ENTITIES } from "./game/world";
import {
  buyFurniture,
  claimTask,
  createNewGame,
  DECORATION_INFO,
  FURNITURE_INFO,
  fulfillRequest,
  getVillagerDialogue,
  interactWith,
  ITEM_INFO,
  loadGame,
  moveFurniture,
  nextDay,
  payHomeDebt,
  placeDecoration,
  placeFurniture,
  returnFurniture,
  saveGame,
  sellItems,
  TASKS,
  taskProgress,
  TOOL_INFO,
  VILLAGER_INFO,
} from "./game/engine";
import type {
  DecorationKind,
  FurnitureKind,
  GameState,
  ItemId,
  Location,
  Position,
  TimeOfDay,
  Tool,
  WorldEntity,
} from "./game/types";

type Panel =
  | "phone"
  | "pockets"
  | "journal"
  | "settings"
  | "map"
  | "shop"
  | "decorate"
  | "home"
  | "help"
  | "friends"
  | "furnish"
  | null;
type Conversation = {
  speaker: string;
  message: string;
  animal?: string;
  villagerId?: string;
  mode?: "greeting" | "request" | "thanks";
};
type Fishing = { entity: WorldEntity; phase: "waiting" | "bite" };
const TOOLS: Tool[] = ["hand", "net", "rod", "shovel"];
const ITEM_ORDER: ItemId[] = [
  "peach",
  "wood",
  "stone",
  "shell",
  "fish",
  "butterfly",
  "flower",
];
const furnitureKinds = Object.keys(FURNITURE_INFO) as FurnitureKind[];

export default function App() {
  const [game, setGame] = useState<GameState>(loadGame);
  const gameRef = useRef(game);
  const [location, setLocation] = useState<Location>("island");
  const locationRef = useRef<Location>("island");
  const sceneRef = useRef<IslandScene | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [nearby, setNearby] = useState<WorldEntity | null>(null);
  const [dialogue, setDialogue] = useState<Conversation | null>(null);
  const [fishing, setFishing] = useState<Fishing | null>(null);
  const [catchNotice, setCatchNotice] = useState<{
    item: ItemId;
    text: string;
  } | null>(null);
  const [toolWheel, setToolWheel] = useState(false);
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  const [heldFurniture, setHeldFurniture] = useState<FurnitureKind | null>(
    null,
  );
  const [navigation, setNavigation] = useState<
    { entityId: string } | { point: Position } | null
  >(null);
  const [shopTab, setShopTab] = useState<"sell" | "furniture" | "garden">(
    "furniture",
  );
  const [toast, setToast] = useState("");
  const [toastPositive, setToastPositive] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [saved, setSaved] = useState(true);
  const [nameDraft, setNameDraft] = useState(game.name);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [cameraView, setCameraView] = useState<"close" | "normal" | "wide">(
    "normal",
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const onInteractRef = useRef<(entity: WorldEntity) => void>(() => {});
  const enterLocationRef = useRef<(next: Location) => void>(() => {});
  const reelRef = useRef<() => void>(() => {});
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});

  const commit = useCallback((state: GameState) => {
    gameRef.current = state;
    setGame(state);
  }, []);
  const notify = useCallback((message: string, positive = true) => {
    setToast(message);
    setToastPositive(positive);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const applyResult = (result: { state: GameState; message: string }) => {
    const changed = result.state !== gameRef.current;
    commit(result.state);
    notify(result.message, changed);
    if (changed && gameRef.current.sound) chime();
    return changed;
  };
  const enterLocation = (next: Location) => {
    setPanel(null);
    setDialogue(null);
    setSelectedFurniture(null);
    setToolWheel(false);
    setNearby(null);
    setTransitioning(true);
    locationRef.current = next;
    setLocation(next);
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setTransitioning(false), 550);
  };
  enterLocationRef.current = enterLocation;
  const open = (next: Panel) => {
    setPanel(next);
    setDialogue(null);
    setSelectedFurniture(null);
    setToolWheel(false);
    setSelectedItem(null);
    setHeldFurniture(null);
    setResetConfirm(false);
  };
  const travelTo = (
    destination: { entityId: string } | { point: Position },
  ) => {
    setNavigation(destination);
    if (locationRef.current === "home") enterLocation("island");
    else setPanel(null);
  };
  const close = () => {
    setPanel(null);
    setDialogue(null);
    setCatchNotice(null);
    setToolWheel(false);
    setSelectedFurniture(null);
    setResetConfirm(false);
  };
  const chooseTool = (tool: Tool) => {
    commit({ ...gameRef.current, tool });
    setToolWheel(false);
  };
  const toggleSound = () => {
    const enabled = !gameRef.current.sound;
    commit({ ...gameRef.current, sound: enabled });
    setAmbient(enabled);
    if (enabled) chime();
  };
  const talkTo = (entity: WorldEntity) => {
    const result = interactWith(gameRef.current, entity);
    commit(result.state);
    setDialogue({
      speaker: entity.name,
      message: result.message,
      animal: VILLAGER_INFO[entity.id]?.animal,
      villagerId: entity.id,
      mode: "greeting",
    });
  };
  const performInteraction = (entity: WorldEntity) => {
    if (entity.kind === "home") {
      enterLocation("home");
      return;
    }
    if (entity.kind === "exit") {
      enterLocation("island");
      return;
    }
    if (entity.kind === "bed") {
      open("home");
      return;
    }
    if (entity.kind === "villager") {
      talkTo(entity);
      return;
    }
    if (entity.kind === "shop") {
      setShopTab("furniture");
      open("shop");
      return;
    }
    const result = interactWith(gameRef.current, entity);
    commit(result.state);
    if (result.kind === "success") {
      sceneRef.current?.playAction(
        entity.kind === "tree"
          ? "shake"
          : entity.kind === "rock"
            ? "dig"
            : entity.kind === "butterfly"
              ? "catch"
              : entity.kind === "fish"
                ? "catch"
                : "pickup",
        entity,
      );
      if (entity.kind === "fish")
        setCatchNotice({
          item: "fish",
          text: "I caught a river fish!\nNow that's a fresh start.",
        });
      else if (entity.kind === "butterfly")
        setCatchNotice({
          item: "butterfly",
          text: "I caught a butterfly!\nI guess we're on a first-flutter basis.",
        });
      else notify(result.message);
      if (gameRef.current.sound) chime();
    } else notify(result.message, false);
  };
  onInteractRef.current = (entity) => {
    if (
      entity.kind === "fish" &&
      gameRef.current.tool === "rod" &&
      !gameRef.current.gathered.includes(entity.id)
    ) {
      sceneRef.current?.playAction("cast", entity);
      setFishing({ entity, phase: "waiting" });
      setToast("");
    } else performInteraction(entity);
  };
  reelRef.current = () => {
    if (!fishing) return;
    if (fishing.phase === "bite") {
      const entity = fishing.entity;
      setFishing(null);
      performInteraction(entity);
    } else {
      setFishing(null);
      sceneRef.current?.playAction("pickup");
      notify("A little too soon! Wait for the bobber to dip.", false);
    }
  };
  const moveSelected = (dx: number, dz: number, rotate = false) => {
    const current = gameRef.current.room.find(
      (item) => item.id === selectedFurniture,
    );
    if (!current) return;
    const position = { x: current.x + dx, z: current.z + dz };
    const rotation = rotate ? (current.rotation + 1) % 4 : current.rotation;
    const person = sceneRef.current?.getPlayerPosition();
    const dimensions = FURNITURE_INFO[current.kind];
    const width = rotation % 2 ? dimensions.depth : dimensions.width;
    const depth = rotation % 2 ? dimensions.width : dimensions.depth;
    if (
      current.kind !== "rug" &&
      person &&
      Math.abs(person.x - position.x) < width / 2 + 0.26 &&
      Math.abs(person.z - position.z) < depth / 2 + 0.26
    ) {
      notify("You’re standing there! Move out of the way first.", false);
      return;
    }
    const result = moveFurniture(
      gameRef.current,
      current.id,
      position,
      rotation,
    );
    if (result.state === gameRef.current) notify(result.message, false);
    else commit(result.state);
  };
  keyRef.current = (event) => {
    if (
      (event.target as HTMLElement)?.matches("input,textarea") ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    const key = event.key.toLowerCase();
    if (event.repeat && !selectedFurniture) return;
    if (key === "escape") {
      close();
      if (fishing) {
        setFishing(null);
        sceneRef.current?.playAction("pickup");
      }
      return;
    }
    if (fishing && (key === "e" || event.code === "Space")) {
      event.preventDefault();
      reelRef.current();
      return;
    }
    if (
      catchNotice &&
      (key === "e" || event.code === "Space" || key === "enter")
    ) {
      event.preventDefault();
      setCatchNotice(null);
      return;
    }
    if (dialogue) return;
    if (selectedFurniture) {
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", "r"].includes(key)
      ) {
        event.preventDefault();
        moveSelected(
          key === "arrowleft" ? -0.5 : key === "arrowright" ? 0.5 : 0,
          key === "arrowup" ? -0.5 : key === "arrowdown" ? 0.5 : 0,
          key === "r",
        );
      }
      return;
    }
    if (panel || dialogue || catchNotice) return;
    if (event.code === "Tab") {
      event.preventDefault();
      setToolWheel((value) => !value);
      return;
    }
    if (["1", "2", "3", "4"].includes(key)) chooseTool(TOOLS[Number(key) - 1]);
    if (key === "b") open("pockets");
    if (key === "m") open("map");
    if (key === "g") open("journal");
    if (key === "p") open("phone");
    if (key === "f")
      open(locationRef.current === "home" ? "furnish" : "decorate");
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      const scene = new IslandScene(canvasRef.current, {
        initialPlayer: gameRef.current.player,
        onNear: (entity) =>
          setNearby((previous) =>
            previous?.id === entity?.id && previous?.name === entity?.name
              ? previous
              : entity,
          ),
        onInteract: (entity) => onInteractRef.current(entity),
        onMove: (player) => {
          if (locationRef.current === "island")
            commit({ ...gameRef.current, player });
        },
        onReady: () => setReady(true),
        onExitHome: () => enterLocationRef.current("island"),
        onFurnitureSelect: (id) => {
          setSelectedFurniture(id);
          setPanel(null);
        },
      });
      sceneRef.current = scene;
      scene.sync({ ...gameRef.current, location: "island", paused: false });
      return () => {
        scene.destroy();
        sceneRef.current = null;
      };
    } catch (error) {
      console.error(error);
      setSceneError(true);
    }
  }, [commit]);
  useEffect(() => {
    sceneRef.current?.sync({
      ...game,
      location,
      paused:
        !!panel ||
        !!dialogue ||
        !!fishing ||
        !!catchNotice ||
        toolWheel ||
        !!selectedFurniture,
    });
    if (navigation && location === "island") {
      if ("entityId" in navigation)
        sceneRef.current?.visit(navigation.entityId);
      else
        sceneRef.current?.setWaypoint(navigation.point.x, navigation.point.z);
      setNavigation(null);
    }
  }, [
    game,
    location,
    panel,
    dialogue,
    fishing,
    catchNotice,
    toolWheel,
    selectedFurniture,
    navigation,
  ]);
  useEffect(() => {
    const timer = setTimeout(() => setSaved(saveGame(game)), 650);
    return () => clearTimeout(timer);
  }, [game]);
  useEffect(() => {
    const save = () => saveGame(gameRef.current);
    const keys = (event: KeyboardEvent) => keyRef.current(event);
    const resumeSound = () => {
      if (gameRef.current.sound) setAmbient(true);
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("pagehide", save);
    window.addEventListener("pointerdown", resumeSound, { once: true });
    const timer = setInterval(() => setClock(new Date()), 10000);
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("pointerdown", resumeSound);
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      clearTimeout(transitionTimer.current);
      setAmbient(false);
    };
  }, []);
  useEffect(() => {
    if (!fishing) return;
    if (fishing.phase === "waiting") {
      const timer = setTimeout(
        () => {
          sceneRef.current?.playAction("bite", fishing.entity);
          setFishing((current) =>
            current ? { ...current, phase: "bite" } : null,
          );
          if (gameRef.current.sound) chime();
        },
        2600 + Math.random() * 1600,
      );
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setFishing(null);
      sceneRef.current?.playAction("pickup");
      notify("It got away! Reel in as soon as the bobber dips.", false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [fishing, notify]);
  useEffect(() => {
    if (!panel && !dialogue && !catchNotice && !toolWheel) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const selector = 'button:not(:disabled), input, a[href], [tabindex="0"]';
    const frame = requestAnimationFrame(() =>
      modal?.querySelector<HTMLElement>(selector)?.focus(),
    );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !modal) return;
      const items = Array.from(modal.querySelectorAll<HTMLElement>(selector));
      if (
        event.shiftKey &&
        (document.activeElement === items[0] ||
          !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === items.at(-1) ||
          !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [panel, dialogue, catchNotice, toolWheel]);

  const totalItems = [
    ...Object.values(game.inventory),
    ...Object.values(game.furniture),
  ].reduce((sum, n) => sum + n, 0);
  const pocketEntries = [
    ...ITEM_ORDER.filter((id) => game.inventory[id] > 0).map((id) => ({
      key: `item:${id}`,
      label: ITEM_INFO[id].name,
      count: game.inventory[id],
      item: id,
      furniture: undefined,
    })),
    ...furnitureKinds
      .filter((kind) => game.furniture[kind] > 0)
      .map((kind) => ({
        key: `furniture:${kind}`,
        label: FURNITURE_INFO[kind].name,
        count: game.furniture[kind],
        item: undefined,
        furniture: kind,
      })),
  ];
  const completedGoals = TASKS.filter((task) =>
    game.completed.includes(task.id),
  ).length;
  const sellValue = ITEM_ORDER.reduce(
    (sum, id) =>
      sum + (id === "flower" ? 0 : ITEM_INFO[id].price * game.inventory[id]),
    0,
  );
  const time = clock
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .split(" ");
  const currentFurniture = game.room.find(
    (item) => item.id === selectedFurniture,
  );
  const villager = dialogue?.villagerId
    ? getVillagerDialogue(game, dialogue.villagerId)
    : null;
  const isBusy =
    !!panel ||
    !!dialogue ||
    !!fishing ||
    !!catchNotice ||
    toolWheel ||
    !!selectedFurniture;
  const interactLabel = nearby
    ? nearby.kind === "villager"
      ? "Talk"
      : nearby.kind === "home"
        ? "Go inside"
        : nearby.kind === "exit"
          ? "Go outside"
          : nearby.kind === "bed"
            ? "Rest"
            : nearby.kind === "shop"
              ? "Go shopping"
              : nearby.kind === "tree"
                ? "Shake tree"
                : nearby.kind === "fish"
                  ? "Cast line"
                  : nearby.kind === "rock"
                    ? "Hit rock"
                    : nearby.kind === "butterfly"
                      ? "Catch"
                      : "Pick up"
    : TOOL_INFO[game.tool].name;
  const rest = () => {
    const state = nextDay(gameRef.current);
    commit(state);
    setPanel(null);
    notify(`Good morning! It's day ${state.day} on ${state.name} Island.`);
  };
  const decorate = (kind: DecorationKind) => {
    const position = sceneRef.current?.getDecorationPosition();
    if (!position) {
      notify("Find an open patch of grass first.", false);
      return;
    }
    if (applyResult(placeDecoration(gameRef.current, kind, position)))
      setPanel(null);
  };
  const furnish = (kind: FurnitureKind) => {
    const position = sceneRef.current?.getFurniturePosition(kind);
    if (!position) {
      notify(
        "There isn’t enough room here. Move a few things and try again.",
        false,
      );
      return;
    }
    if (applyResult(placeFurniture(gameRef.current, kind, position))) {
      setPanel(null);
    }
  };
  const requestHelp = () => {
    if (!dialogue?.villagerId || !villager?.request) return;
    setDialogue({
      ...dialogue,
      mode: "request",
      message: villager.request.delivered
        ? "You already made my day! Come see me tomorrow, okay?"
        : villager.request.text,
    });
  };
  const deliver = () => {
    if (!dialogue?.villagerId) return;
    const result = fulfillRequest(gameRef.current, dialogue.villagerId);
    commit(result.state);
    setDialogue({ ...dialogue, mode: "thanks", message: result.message });
    if (result.state !== game && game.sound) chime();
  };

  return (
    <main
      className={`game-screen mood-${game.timeOfDay} ${location === "home" ? "inside-home" : ""}`}
    >
      <div
        ref={canvasRef}
        className="world-canvas"
        aria-label="Little Isle, a walkable 3D village. WASD moves, E interacts, B opens pockets."
      />
      {(!ready || sceneError) && (
        <div className="loading-screen">
          <LeafMark />
          <h1>
            {sceneError ? "Let’s try that again." : "Your island is waking up…"}
          </h1>
          {sceneError ? (
            <>
              <p>A WebGL-capable browser is needed to visit the island.</p>
              <button onClick={() => window.location.reload()}>
                Try again
              </button>
            </>
          ) : (
            <span className="loading-dots">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      )}
      <div
        className={`scene-transition ${transitioning ? "visible" : ""}`}
        aria-hidden="true"
      >
        <LeafMark />
      </div>

      {!isBusy && (
        <>
          <div className="top-left-hud">
            <button
              className="phone-shortcut"
              onClick={() => open("phone")}
              aria-label="Open island phone"
            >
              <kbd>P</kbd>
              <Smartphone size={31} />
            </button>
            <span className="island-location">
              {location === "home" ? <House size={15} /> : <Leaf size={15} />}
              <span>
                {location === "home"
                  ? "Home sweet home"
                  : `${game.name} Island`}
              </span>
            </span>
          </div>
          <div className="top-right-hud">
            <div className="bells">
              <span className="bell-bag">★</span>
              <strong>{game.bells.toLocaleString()}</strong>
            </div>
            <button
              className="round-hud"
              onClick={() => open("pockets")}
              aria-label="Open pockets"
            >
              <Backpack size={25} />
              <kbd>B</kbd>
            </button>
          </div>
          <div className="clock-hud">
            <div className="clock-line">
              <strong>{time[0]}</strong>
              <span>{time[1]}</span>
            </div>
            <div className="date-line">
              {clock.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
              <span>
                {clock.toLocaleDateString("en-US", { weekday: "short" })}.
              </span>
            </div>
            <span className="save-indicator">
              {saved ? <Check size={11} /> : <CircleHelp size={11} />}{" "}
              {saved ? "Saved" : "Save unavailable"}
            </span>
          </div>
          <div className="bottom-center-hud">
            <div className="context-row">
              <button
                className="equipped-tool"
                onClick={() => setToolWheel(true)}
                aria-label="Choose a tool"
              >
                <ToolIcon tool={game.tool} size={35} />
                <kbd>Tab</kbd>
              </button>
              {nearby ? (
                <button
                  className="action-prompt"
                  onClick={() => sceneRef.current?.interact()}
                >
                  <kbd>E</kbd>
                  {interactLabel}
                  <span>{nearby.kind === "villager" ? nearby.name : ""}</span>
                </button>
              ) : (
                <span className="equipped-name">
                  {TOOL_INFO[game.tool].name}
                </span>
              )}
            </div>
            <span className="movement-hint">
              <kbd>WASD</kbd> Move<span>·</span> Click to walk<span>·</span>
              <kbd>1–4</kbd> Tools
            </span>
          </div>
          {location === "island" ? (
            <button
              className="map-hud"
              onClick={() => open("map")}
              aria-label="Open island map"
            >
              <IslandMap player={game.player} />
              <span>
                <kbd>M</kbd> Map
              </span>
            </button>
          ) : (
            <div className="home-hud">
              <button onClick={() => open("furnish")}>
                <Hammer size={21} />
                <span>Furnish</span>
                <kbd>F</kbd>
              </button>
              <button onClick={() => enterLocation("island")}>
                <DoorOpen size={21} />
                <span>Go outside</span>
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div
          className={`toast ${toastPositive ? "success" : ""}`}
          role="status"
        >
          {toastPositive ? <Sparkles size={20} /> : <Leaf size={20} />}
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {fishing && (
        <div
          className={`fishing-hud ${fishing.phase === "bite" ? "bite" : ""}`}
        >
          <span className="fishing-exclamation">
            {fishing.phase === "bite" ? "!" : "…"}
          </span>
          <button onClick={() => reelRef.current()}>
            <kbd>E</kbd>
            <strong>
              {fishing.phase === "bite"
                ? "Reel it in!"
                : "Wait for the bobber…"}
            </strong>
          </button>
          <span>
            {fishing.phase === "bite"
              ? "Now! Press E or Space."
              : "Listen carefully. Something might be nibbling."}
          </span>
          <button
            className="cancel-fishing"
            onClick={() => {
              setFishing(null);
              sceneRef.current?.playAction("pickup");
            }}
          >
            Put away
          </button>
        </div>
      )}
      {catchNotice && (
        <div
          className="catch-screen"
          role="dialog"
          aria-modal="true"
          aria-label="Your catch"
        >
          <div className="catch-art">
            <span>✧</span>
            <ItemArt item={catchNotice.item} />
            <span>✧</span>
          </div>
          <div className="speech-bubble catch-bubble">
            <p>{catchNotice.text}</p>
            <button onClick={() => setCatchNotice(null)}>
              Into my pockets! <kbd>E</kbd>
            </button>
          </div>
        </div>
      )}
      {dialogue && (
        <DialogueBox
          speaker={dialogue.speaker}
          message={dialogue.message}
          animal={dialogue.animal}
          friendship={villager?.friendship ?? 0}
          onClose={() => setDialogue(null)}
          choices={
            dialogue.villagerId
              ? [
                  ...(dialogue.mode === "greeting"
                    ? [
                        {
                          label: "Need a hand with anything?",
                          action: requestHelp,
                        },
                      ]
                    : []),
                  ...(dialogue.mode === "request" &&
                  villager?.request &&
                  !villager.request.delivered
                    ? [
                        {
                          label: villager.request.canDeliver
                            ? "I brought what you wanted!"
                            : `I’ll find ${villager.request.count} ${ITEM_INFO[villager.request.item].name.toLowerCase()}${villager.request.count > 1 ? "s" : ""}.`,
                          action: villager.request.canDeliver
                            ? deliver
                            : () => setDialogue(null),
                        },
                      ]
                    : []),
                  {
                    label:
                      dialogue.mode === "thanks"
                        ? "Happy to help!"
                        : "See you around!",
                    action: () => setDialogue(null),
                  },
                ]
              : undefined
          }
        />
      )}

      {toolWheel && (
        <div
          className="tool-wheel-backdrop"
          onClick={() => setToolWheel(false)}
        >
          <section
            className="tool-wheel"
            role="dialog"
            aria-modal="true"
            aria-label="Choose your tool"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="wheel-label">What shall we do?</span>
            {TOOLS.map((tool, index) => (
              <button
                key={tool}
                className={`wheel-tool wheel-${index} ${game.tool === tool ? "active" : ""}`}
                onClick={() => chooseTool(tool)}
              >
                <ToolIcon tool={tool} size={58} />
                <strong>{TOOL_INFO[tool].name}</strong>
                <kbd>{index + 1}</kbd>
              </button>
            ))}
            <button
              className="wheel-center"
              onClick={() => setToolWheel(false)}
              aria-label="Close tool wheel"
            >
              <X size={23} />
            </button>
            <span className="wheel-tip">
              A good day starts with the right tool.
            </span>
          </section>
        </div>
      )}

      {currentFurniture && (
        <div
          className="furniture-controls"
          role="dialog"
          aria-label={`Arrange ${FURNITURE_INFO[currentFurniture.kind].name}`}
        >
          <div>
            <span>{FURNITURE_INFO[currentFurniture.kind].emoji}</span>
            <strong>{FURNITURE_INFO[currentFurniture.kind].name}</strong>
            <button
              onClick={() => setSelectedFurniture(null)}
              aria-label="Finish arranging"
            >
              <Check size={22} />
            </button>
          </div>
          <div className="furniture-actions">
            <button
              onClick={() => moveSelected(-0.5, 0)}
              aria-label="Move furniture left"
            >
              <ArrowLeft />
            </button>
            <button
              onClick={() => moveSelected(0, -0.5)}
              aria-label="Move furniture back"
            >
              <ArrowUp />
            </button>
            <button
              onClick={() => moveSelected(0, 0.5)}
              aria-label="Move furniture forward"
            >
              <ArrowDown />
            </button>
            <button
              onClick={() => moveSelected(0.5, 0)}
              aria-label="Move furniture right"
            >
              <ArrowRight />
            </button>
            <button
              onClick={() => moveSelected(0, 0, true)}
              aria-label="Rotate furniture"
            >
              <RotateCw />
            </button>
            <button
              onClick={() => {
                applyResult(
                  returnFurniture(gameRef.current, currentFurniture.id),
                );
                setSelectedFurniture(null);
              }}
              aria-label="Put furniture in pockets"
            >
              <Backpack />
            </button>
          </div>
          <small>
            Arrow keys to move · R to rotate · Esc when you’re happy
          </small>
        </div>
      )}

      {panel && (
        <div
          className={`panel-backdrop panel-backdrop-${panel}`}
          onClick={() => setPanel(null)}
        >
          <section
            className={`game-panel panel-${panel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="panel-close"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
            >
              <X size={23} />
            </button>
            {panel === "phone" && (
              <>
                <div className="phone-topline">
                  <span>{time[0]}</span>
                  <span>▰ ▰ ▰</span>
                </div>
                <h2 id="panel-title">Island phone</h2>
                <span className="phone-greeting">
                  A whole island in your pocket.
                </span>
                <div className="phone-apps">
                  {[
                    {
                      id: "pockets",
                      name: "Pockets",
                      icon: <Backpack />,
                      color: "yellow",
                    },
                    { id: "map", name: "Map", icon: <Map />, color: "green" },
                    {
                      id: "friends",
                      name: "Neighbors",
                      icon: <Heart />,
                      color: "pink",
                    },
                    {
                      id: "journal",
                      name: "Island life",
                      icon: <BookOpen />,
                      color: "blue",
                    },
                    {
                      id: location === "home" ? "furnish" : "decorate",
                      name: "Decorate",
                      icon: <Hammer />,
                      color: "orange",
                    },
                    {
                      id: "home",
                      name: "My home",
                      icon: <House />,
                      color: "teal",
                    },
                    {
                      id: "settings",
                      name: "Settings",
                      icon: <Settings />,
                      color: "purple",
                    },
                    {
                      id: "help",
                      name: "How to play",
                      icon: <CircleHelp />,
                      color: "mint",
                    },
                  ].map((app) => (
                    <button key={app.id} onClick={() => open(app.id as Panel)}>
                      <span className={`phone-app-icon ${app.color}`}>
                        {app.icon}
                      </span>
                      <strong>{app.name}</strong>
                    </button>
                  ))}
                </div>
                <div className="phone-bottom">
                  <LeafMark />
                  <span>{game.name} Island</span>
                </div>
              </>
            )}

            {panel === "pockets" && (
              <>
                <div className="panel-title-line">
                  <Backpack />
                  <h2 id="panel-title">Pockets</h2>
                </div>
                <p className="panel-subtitle">
                  Everything you picked up along the way.
                </p>
                <div className="pockets-grid">
                  {Array.from({ length: 20 }, (_, i) => {
                    const entry = pocketEntries[i];
                    return entry ? (
                      <button
                        key={entry.key}
                        className={`pocket-slot ${entry.item === selectedItem || entry.furniture === heldFurniture ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedItem(entry.item ?? null);
                          setHeldFurniture(entry.furniture ?? null);
                        }}
                        aria-label={`${entry.label}, ${entry.count}`}
                      >
                        <ItemArt item={entry.item ?? "furniture"} />
                        <span>{entry.count}</span>
                      </button>
                    ) : (
                      <span className="pocket-slot empty" key={`empty-${i}`} />
                    );
                  })}
                </div>
                <div className="pocket-tools">
                  {TOOLS.map((tool, i) => (
                    <button
                      key={tool}
                      onClick={() => {
                        chooseTool(tool);
                        setPanel(null);
                      }}
                    >
                      <ToolIcon tool={tool} size={33} />
                      <span>{TOOL_INFO[tool].name}</span>
                      <kbd>{i + 1}</kbd>
                    </button>
                  ))}
                </div>
                <div className="pocket-detail">
                  {heldFurniture ? (
                    <>
                      <span className="held-furniture-art">
                        {FURNITURE_INFO[heldFurniture].emoji}
                      </span>
                      <div>
                        <strong>{FURNITURE_INFO[heldFurniture].name}</strong>
                        <p>{FURNITURE_INFO[heldFurniture].description}</p>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          location === "home"
                            ? furnish(heldFurniture)
                            : travelTo({ entityId: "home" })
                        }
                      >
                        {location === "home" ? "Place" : "Take home"}
                      </button>
                    </>
                  ) : selectedItem ? (
                    <>
                      <ItemArt item={selectedItem} />
                      <div>
                        <strong>{ITEM_INFO[selectedItem].name}</strong>
                        <p>{ITEM_INFO[selectedItem].description}</p>
                      </div>
                      <span className="item-value">
                        {selectedItem === "flower"
                          ? "Plant outside"
                          : `${ITEM_INFO[selectedItem].price} bells each`}
                      </span>
                    </>
                  ) : (
                    <span>Choose an item to take a closer look.</span>
                  )}
                </div>
                <div className="pocket-footer">
                  <span>
                    <Backpack size={18} />
                    {totalItems} items
                  </span>
                  <span>
                    <Coins size={18} />
                    {sellValue.toLocaleString()} bell value
                  </span>
                  <button
                    onClick={() =>
                      open(location === "home" ? "furnish" : "decorate")
                    }
                  >
                    <Hammer size={17} />
                    Decorate
                  </button>
                </div>
              </>
            )}

            {panel === "map" && (
              <>
                <div className="panel-title-line">
                  <Map />
                  <h2 id="panel-title">{game.name} Island</h2>
                </div>
                <p className="panel-subtitle">
                  Somewhere good to get a little lost.
                </p>
                <IslandMap
                  player={game.player}
                  large
                  onSelect={(x, z) => travelTo({ point: { x, z } })}
                />
                <div className="map-legend">
                  <span>
                    <i className="map-home" />
                    Your home
                  </span>
                  <span>
                    <i className="map-market" />
                    Market
                  </span>
                  <span>
                    <i className="map-you" />
                    You
                  </span>
                </div>
                <div className="landmarks">
                  {WORLD_ENTITIES.filter((e) =>
                    ["home", "shop", "villager"].includes(e.kind),
                  ).map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => travelTo({ entityId: entity.id })}
                    >
                      {entity.kind === "home" ? (
                        <House size={19} />
                      ) : entity.kind === "shop" ? (
                        <ShoppingBasket size={19} />
                      ) : (
                        <Heart size={19} />
                      )}
                      <span>{entity.name}</span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {panel === "friends" && (
              <>
                <div className="panel-title-line">
                  <Heart />
                  <h2 id="panel-title">Your neighbors</h2>
                </div>
                <p className="panel-subtitle">
                  A little island. A few familiar faces.
                </p>
                <div className="neighbor-list">
                  {Object.entries(VILLAGER_INFO).map(([id, person]) => {
                    const friend = getVillagerDialogue(game, id),
                      met = game.met.includes(person.name);
                    return (
                      <div className="neighbor-card" key={id}>
                        <Avatar animal={person.animal} />
                        <div>
                          <h3>
                            {person.name}
                            <span>{person.personality}</span>
                          </h3>
                          <div className="friendship-hearts">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Heart
                                size={16}
                                key={i}
                                fill={
                                  friend.friendship > i * 4
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            ))}
                          </div>
                          <p>
                            {!met
                              ? "You haven’t met yet. Go say hello!"
                              : friend.request?.delivered
                                ? "You helped out today. Come back tomorrow!"
                                : `${person.request.text}`}
                          </p>
                          <button onClick={() => travelTo({ entityId: id })}>
                            Find {person.name}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {panel === "shop" && (
              <>
                <div className="shop-heading">
                  <Avatar animal="bear" />
                  <div>
                    <span>WELCOME TO</span>
                    <h2 id="panel-title">Fern & Fig</h2>
                    <p>Something new for somewhere you love.</p>
                  </div>
                </div>
                <div className="shop-tabs">
                  {(["furniture", "sell", "garden"] as const).map((tab) => (
                    <button
                      className={shopTab === tab ? "active" : ""}
                      key={tab}
                      onClick={() => setShopTab(tab)}
                    >
                      {tab === "furniture"
                        ? "For your home"
                        : tab === "sell"
                          ? "Sell items"
                          : "Garden"}
                    </button>
                  ))}
                </div>
                <div className="shop-wallet">
                  <span>Your bells</span>
                  <strong>★ {game.bells.toLocaleString()}</strong>
                </div>
                {shopTab === "furniture" ? (
                  <div className="catalog-grid">
                    {furnitureKinds.map((kind) => {
                      const item = FURNITURE_INFO[kind];
                      return (
                        <button
                          className="catalog-item"
                          key={kind}
                          disabled={game.bells < item.price}
                          onClick={() =>
                            applyResult(buyFurniture(gameRef.current, kind))
                          }
                        >
                          <span className="catalog-art">{item.emoji}</span>
                          <strong>{item.name}</strong>
                          <small>{item.description}</small>
                          <span className="price-tag">
                            ★ {item.price.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : shopTab === "sell" ? (
                  <div className="sell-content">
                    <span className="sell-bag">💰</span>
                    <h3>Let’s see what you found!</h3>
                    <p>
                      Fruit, fish, bugs, shells, stone, and wood.
                      <br />
                      We’ll leave your flower seeds in your pockets.
                    </p>
                    <div className="sale-items">
                      {ITEM_ORDER.filter(
                        (id) => id !== "flower" && game.inventory[id] > 0,
                      ).map((id) => (
                        <span key={id}>
                          <ItemArt item={id} />
                          <small>×{game.inventory[id]}</small>
                        </span>
                      ))}
                    </div>
                    <strong className="sale-value">
                      {sellValue.toLocaleString()}
                      <span>bells</span>
                    </strong>
                    <button
                      className="primary-button"
                      disabled={!sellValue}
                      onClick={() => applyResult(sellItems(gameRef.current))}
                    >
                      {sellValue
                        ? "It’s a deal!"
                        : "Come back with something to sell"}
                    </button>
                  </div>
                ) : (
                  <div className="garden-shop">
                    <ItemArt item="flower" />
                    <h3>Wildflower seeds</h3>
                    <p>Three chances to brighten up your island.</p>
                    <button
                      className="primary-button"
                      disabled={game.bells < 80}
                      onClick={() => {
                        commit({
                          ...game,
                          bells: game.bells - 80,
                          inventory: {
                            ...game.inventory,
                            flower: game.inventory.flower + 3,
                          },
                        });
                        notify(
                          "Three flower seeds. Find them in Decorate outside.",
                        );
                      }}
                    >
                      3 seeds · 80 bells
                    </button>
                  </div>
                )}
                <span className="shop-footnote">
                  Furniture goes into your pockets. Place it inside your house.
                </span>
              </>
            )}

            {(panel === "decorate" || panel === "furnish") && (
              <>
                <div className="panel-title-line">
                  <Hammer />
                  <h2 id="panel-title">
                    {panel === "furnish"
                      ? "Make yourself at home"
                      : "Make it yours"}
                  </h2>
                </div>
                <p className="panel-subtitle">
                  {panel === "furnish"
                    ? "Your things, just where you like them."
                    : "Find your favorite spot, then add a little you."}
                </p>
                {panel === "furnish" && location !== "home" ? (
                  <div className="empty-state">
                    <House size={50} />
                    <h3>Home is the place.</h3>
                    <p>Visit your cottage to place your furniture.</p>
                    <button
                      className="primary-button"
                      onClick={() => travelTo({ entityId: "home" })}
                    >
                      Find my cottage
                    </button>
                  </div>
                ) : panel === "furnish" ? (
                  <>
                    <div className="catalog-grid owned-furniture">
                      {furnitureKinds
                        .filter((kind) => game.furniture[kind] > 0)
                        .map((kind) => (
                          <button
                            className="catalog-item"
                            key={kind}
                            onClick={() => furnish(kind)}
                          >
                            <span className="catalog-art">
                              {FURNITURE_INFO[kind].emoji}
                            </span>
                            <strong>{FURNITURE_INFO[kind].name}</strong>
                            <span className="owned-count">
                              × {game.furniture[kind]} · Place
                            </span>
                          </button>
                        ))}
                    </div>
                    {!furnitureKinds.some(
                      (kind) => game.furniture[kind] > 0,
                    ) && (
                      <div className="empty-state">
                        <LeafMark />
                        <h3>Room for something new.</h3>
                        <p>
                          Find furniture at Fern & Fig, or move the things you
                          already own.
                        </p>
                      </div>
                    )}
                    <h3 className="section-title">ALREADY AT HOME</h3>
                    <div className="room-items">
                      {game.room.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedFurniture(item.id);
                            setPanel(null);
                          }}
                        >
                          <span>{FURNITURE_INFO[item.kind].emoji}</span>
                          <strong>{FURNITURE_INFO[item.kind].name}</strong>
                          <span>
                            Arrange <ArrowRight size={14} />
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="soft-tip">
                      You can also click any piece of furniture in your room to
                      move, rotate, or put it away.
                    </p>
                  </>
                ) : (
                  <div className="outdoor-decor">
                    {(
                      Object.entries(DECORATION_INFO) as [
                        DecorationKind,
                        (typeof DECORATION_INFO)[DecorationKind],
                      ][]
                    ).map(([kind, item]) => (
                      <button key={kind} onClick={() => decorate(kind)}>
                        <span>{item.emoji}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.description}</p>
                          <small>
                            {kind === "flowers"
                              ? `${game.inventory.flower} flower seeds in pockets`
                              : `★ ${item.price} bells`}
                          </small>
                        </div>
                        <ChevronRight size={20} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {panel === "home" && (
              <>
                <div className="panel-title-line">
                  <House />
                  <h2 id="panel-title">Home, sweet home.</h2>
                </div>
                <p className="panel-subtitle">
                  A place that gets a little more you every day.
                </p>
                <div className="home-summary">
                  <House size={61} strokeWidth={1.5} />
                  <div>
                    <h3>
                      {game.homeLevel
                        ? "A room to grow in"
                        : "Your first island home"}
                    </h3>
                    <p>
                      {game.room.length} pieces of furniture ·{" "}
                      {game.homeLevel ? "Spacious room" : "Cozy room"}
                    </p>
                  </div>
                </div>
                {game.homeDebt > 0 ? (
                  <div className="loan-card">
                    <span>YOUR HOME EXPANSION</span>
                    <h3>
                      {game.homeDebt.toLocaleString()}
                      <small>bells remaining</small>
                    </h3>
                    <div className="loan-progress">
                      <i
                        style={{
                          width: `${(1 - game.homeDebt / 9800) * 100}%`,
                        }}
                      />
                    </div>
                    <p>
                      Pay it off to make room for more of your favorite things.
                    </p>
                    <div className="loan-buttons">
                      <button
                        disabled={game.bells < Math.min(500, game.homeDebt)}
                        onClick={() =>
                          applyResult(payHomeDebt(gameRef.current, 500))
                        }
                      >
                        Pay {Math.min(500, game.homeDebt)} bells
                      </button>
                      <button
                        disabled={game.bells === 0}
                        onClick={() =>
                          applyResult(
                            payHomeDebt(
                              gameRef.current,
                              Math.min(game.bells, game.homeDebt),
                            ),
                          )
                        }
                      >
                        Pay as much as I can
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="home-paid">
                    <Sparkles />
                    <strong>Paid in full!</strong>
                    <p>Your room is bigger, and your possibilities are too.</p>
                  </div>
                )}
                <div className="home-options">
                  {location === "home" ? (
                    <>
                      <button className="primary-button" onClick={rest}>
                        <Moon size={20} />
                        Rest until tomorrow
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => open("furnish")}
                      >
                        <Hammer size={19} />
                        Arrange my room
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => travelTo({ entityId: "home" })}
                    >
                      Walk home <ArrowRight size={19} />
                    </button>
                  )}
                </div>
                <small className="rest-note">
                  A new day brings fresh resources and new requests from your
                  neighbors.
                </small>
              </>
            )}

            {panel === "journal" && (
              <>
                <div className="panel-title-line">
                  <BookOpen />
                  <h2 id="panel-title">Getting settled</h2>
                </div>
                <p className="panel-subtitle">
                  A few first steps. The rest is up to you.
                </p>
                <div className="journal-summary">
                  <LeafMark />
                  <span>
                    <strong>
                      {completedGoals} / {TASKS.length}
                    </strong>{" "}
                    island milestones
                  </span>
                </div>
                <div className="journal-tasks">
                  {TASKS.map((task) => {
                    const current = taskProgress(game, task),
                      done = game.completed.includes(task.id),
                      claimable = current >= task.target;
                    return (
                      <div className="journal-task" key={task.id}>
                        <span className={`task-stamp ${done ? "done" : ""}`}>
                          {done ? <Check /> : <Leaf />}
                        </span>
                        <div>
                          <h3>{task.title}</h3>
                          <p>{task.description}</p>
                          <div className="task-progress">
                            <span
                              style={{
                                width: `${(current / task.target) * 100}%`,
                              }}
                            />
                          </div>
                          <small>
                            {current} / {task.target}
                          </small>
                        </div>
                        <button
                          className={claimable && !done ? "claimable" : ""}
                          disabled={!claimable || done}
                          onClick={() =>
                            applyResult(claimTask(gameRef.current, task.id))
                          }
                        >
                          {done
                            ? "Claimed"
                            : claimable
                              ? `Collect ${task.reward}`
                              : `★ ${task.reward}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {panel === "settings" && (
              <>
                <div className="panel-title-line">
                  <Settings />
                  <h2 id="panel-title">Your island, your way.</h2>
                </div>
                <label className="setting-label" htmlFor="island-name">
                  ISLAND NAME
                </label>
                <form
                  className="name-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const name = nameDraft.trim().slice(0, 18);
                    if (name) {
                      commit({ ...game, name });
                      notify(`Welcome to ${name} Island.`);
                    }
                  }}
                >
                  <input
                    id="island-name"
                    value={nameDraft}
                    maxLength={18}
                    onChange={(event) => setNameDraft(event.target.value)}
                  />
                  <span>Island</span>
                  <button type="submit" aria-label="Save island name">
                    <Check size={23} />
                  </button>
                </form>
                <span className="setting-label">TIME OF DAY</span>
                <div className="setting-options">
                  {(["day", "sunset", "night"] as TimeOfDay[]).map((value) => (
                    <button
                      key={value}
                      className={game.timeOfDay === value ? "active" : ""}
                      onClick={() => commit({ ...game, timeOfDay: value })}
                    >
                      {value === "day" ? (
                        <Sun />
                      ) : value === "sunset" ? (
                        <Sunset />
                      ) : (
                        <Moon />
                      )}
                      <span>
                        {value === "day"
                          ? "Daylight"
                          : value === "sunset"
                            ? "Sunset"
                            : "Night"}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="setting-label">CAMERA DISTANCE</span>
                <div className="setting-options camera-options">
                  {(["close", "normal", "wide"] as const).map((value) => (
                    <button
                      className={cameraView === value ? "active" : ""}
                      key={value}
                      onClick={() => {
                        setCameraView(value);
                        sceneRef.current?.setCamera(value);
                      }}
                    >
                      {value === "close"
                        ? "Closer"
                        : value === "normal"
                          ? "Comfortable"
                          : "Further"}
                    </button>
                  ))}
                </div>
                <button className="sound-setting" onClick={toggleSound}>
                  {game.sound ? <Volume2 /> : <VolumeX />}
                  <span>Island sounds</span>
                  <span className={`toggle ${game.sound ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
                <p className="soft-tip">
                  {saved
                    ? "Your island saves automatically in this browser."
                    : "Saving is unavailable. Keep this tab open to retain your progress."}
                </p>
                {resetConfirm ? (
                  <div className="reset-confirm">
                    <strong>Start a brand-new island?</strong>
                    <p>
                      Your current progress, friendships, and furniture will be
                      cleared.
                    </p>
                    <button
                      onClick={() => {
                        const state = createNewGame();
                        commit(state);
                        setNameDraft(state.name);
                        enterLocation("island");
                        sceneRef.current?.setPlayer(state.player);
                        setAmbient(false);
                        notify("A brand-new island. A brand-new beginning.");
                      }}
                    >
                      Start fresh
                    </button>
                    <button onClick={() => setResetConfirm(false)}>
                      Keep my island
                    </button>
                  </div>
                ) : (
                  <button
                    className="reset-link"
                    onClick={() => setResetConfirm(true)}
                  >
                    <RotateCcw size={14} />
                    Start a new island
                  </button>
                )}
              </>
            )}

            {panel === "help" && (
              <>
                <div className="panel-title-line">
                  <Compass />
                  <h2 id="panel-title">Welcome to island life.</h2>
                </div>
                <p className="panel-subtitle">
                  There’s no rush. Here are a few things you can do.
                </p>
                <div className="help-steps">
                  <div>
                    <span>1</span>
                    <p>
                      <strong>Get to know your neighbors.</strong>Walk with WASD
                      or click the ground. Press E nearby to talk. Ask what they
                      need, then bring it back for friendship and bells.
                    </p>
                  </div>
                  <div>
                    <span>2</span>
                    <p>
                      <strong>Find something good.</strong>Shake fruit trees
                      with empty hands. Catch butterflies with a net. Use the
                      shovel on rocks. Switch tools with 1–4 or Tab.
                    </p>
                  </div>
                  <div>
                    <span>3</span>
                    <p>
                      <strong>Cast a line.</strong>Equip the fishing rod and
                      click a fish. Wait for the bobber to dip, then press E or
                      Space quickly!
                    </p>
                  </div>
                  <div>
                    <span>4</span>
                    <p>
                      <strong>Make a home of your own.</strong>Sell your finds
                      at Fern & Fig and buy furniture. Go inside your house,
                      press F to place it, then click to move or rotate it.
                    </p>
                  </div>
                  <div>
                    <span>5</span>
                    <p>
                      <strong>Look forward to tomorrow.</strong>Rest in your bed
                      to start a new day. Fruit, fish, bugs, and neighbor
                      requests return. Save up to expand your house.
                    </p>
                  </div>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setPanel(null)}
                >
                  Let’s explore! <ArrowRight size={19} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
