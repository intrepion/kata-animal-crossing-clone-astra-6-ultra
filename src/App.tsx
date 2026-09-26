import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Backpack, BookOpen, Check, CheckCheck, ChevronRight, CircleHelp, Coins, Compass, Fish, Flag, Flower2, Hammer, Heart, House, Leaf, Map, Maximize2, Minus, Moon, MousePointer2, Plus, RotateCcw, Settings, ShoppingBasket, Sparkles, Sprout, Sun, Sunset, Volume2, VolumeX, X } from 'lucide-react';
import { Avatar, LeafMark, ToolIcon } from './Icons';
import { chime, setAmbient } from './audio';
import { IslandScene } from './game/scene';
import { WORLD_ENTITIES } from './game/world';
import { claimTask, createNewGame, DECORATION_INFO, interactWith, ITEM_INFO, loadGame, nextDay, placeDecoration, saveGame, sellItems, TASKS, taskProgress, TOOL_INFO } from './game/engine';
import type { DecorationKind, GameState, ItemId, Position, TimeOfDay, Tool, WorldEntity } from './game/types';

type Panel = 'pockets' | 'guide' | 'settings' | 'map' | 'shop' | 'decorate' | 'home' | 'help' | null;
interface Dialogue { speaker: string; message: string; animal: string }
interface Toast { id: number; message: string; positive: boolean }
const tools: Tool[] = ['hand','net','rod','shovel'];
const animalFor = (name:string) => /clover/i.test(name)?'rabbit':/pip/i.test(name)?'duck':'bear';

function IslandMap({player,onSelect,large=false}:{player:Position;onSelect?:(x:number,z:number)=>void;large?:boolean}) {
 const mx=(x:number)=>100+x*5, mz=(z:number)=>86+z*4.6;
 const land=(scale:number)=>Array.from({length:88},(_,i)=>{const a=i/88*Math.PI*2;const r=1+Math.sin(a*3+.8)*.055+Math.sin(a*7-.3)*.025;return `${i?'L':'M'}${mx(Math.cos(a)*17.2*r*scale)},${mz(Math.sin(a)*13.8*r*scale-.8)}`;}).join(' ')+' Z';
 const trace=(points:number[][])=>points.map(([x,z],i)=>`${i?'L':'M'}${mx(x)},${mz(z)}`).join(' ');
 const river=[[-1.7,-13],[-1.2,-10.1],[2,-8.4],[5.7,-7],[6.8,-4.5],[7.2,-1.6],[9,.5],[12.1,1.5],[16,4.2]];
 return <svg className={large?'island-map large':'island-map'} viewBox="0 0 200 176" role="img" aria-label="Island map. Select a spot to walk there." onClick={onSelect?(event)=>{const r=event.currentTarget.getBoundingClientRect();const scale=Math.min(r.width/200,r.height/176);const x=(event.clientX-r.left-(r.width-200*scale)/2)/scale;const y=(event.clientY-r.top-(r.height-176*scale)/2)/scale;onSelect((x-100)/5,(y-86)/4.6);}:undefined}>
  <defs><pattern id={large?'water-big':'water-small'} width="22" height="20" patternUnits="userSpaceOnUse"><path d="M3 10q3 2 6 0" fill="none" stroke="#acd8d3" strokeWidth="1"/></pattern></defs>
  <rect width="200" height="176" rx="20" fill="#c3e2dd"/><rect width="200" height="176" fill={`url(#${large?'water-big':'water-small'})`}/>
  <path d={land(1.06)} fill="#d5e6cd"/><path d={land(1)} fill="#f0dcaf"/><path d={land(.885)} fill="#97b77c"/>
  <path d={trace(river)} fill="none" stroke="#abd9d2" strokeWidth="10" strokeLinejoin="round"/>
  <path d={trace([[-5.1,-6],[-5,-2],[-3,.3],[-.7,2],[1.1,5.5],[1.1,10.7]])} fill="none" stroke="#e2cd9d" strokeWidth="6" strokeLinejoin="round"/>
  <path d={trace([[-10.2,2],[-6.7,2],[-3.8,1.2],[-.7,2],[3,.1],[5.3,-3.4],[8.8,-3.4],[11.3,-4.2]])} fill="none" stroke="#e2cd9d" strokeWidth="6" strokeLinejoin="round"/>
  <rect x={mx(5)} y={mz(-4.2)} width="18" height="8" rx="1" fill="#b58c63"/>
  <rect x={mx(.1)} y={mz(11.2)} width="10" height="20" rx="1" fill="#b58c63"/>
  {WORLD_ENTITIES.filter(e=>['tree','home','shop','villager','rock'].includes(e.kind)).map(e=><g key={e.id} transform={`translate(${mx(e.x)} ${mz(e.z)})`}>
    {e.kind==='tree'?<><circle r="6" fill="#6c9864"/><circle cx="-1" cy="-2" r="4" fill="#7da96d"/><circle cx="3" cy="1" r="1.2" fill="#e8a081"/></>:e.kind==='home'?<><path d="m-8-1 8-7 8 7v9H-8Z" fill="#f4e7c2"/><path d="m-10-1 10-9 10 9" stroke="#c78665" strokeWidth="3.5" strokeLinejoin="round"/></>:e.kind==='shop'?<><rect x="-7" y="-4" width="14" height="11" rx="2" fill="#eee0b9"/><path d="M-8-2H8L6-7H-6Z" fill="#d39b71"/></>:e.kind==='rock'?<ellipse rx="3" ry="2.5" fill="#9ca68c"/>:<circle r="2" fill="#f5e9bd" stroke="#91a676" strokeWidth="1"/>}
  </g>)}
  <circle cx={mx(player.x)} cy={mz(player.z)} r="6" fill="#fff9ed" opacity=".5"/><circle cx={mx(player.x)} cy={mz(player.z)} r="3.5" fill="#d47c55" stroke="#fff9ed" strokeWidth="1.5"/>
  <text x="182" y="21" fontSize="8" fontFamily="sans-serif" fill="#628f87">N</text><path d="m183 27-2 5h4Z" fill="#628f87"/>
 </svg>;
}

export default function App() {
 const [game,setGame] = useState<GameState>(loadGame);
 const gameRef=useRef(game);
 const sceneRef=useRef<IslandScene|null>(null);
 const containerRef=useRef<HTMLDivElement>(null);
 const [panel,setPanel]=useState<Panel>(null);
 const [nearby,setNearby]=useState<WorldEntity|null>(null);
 const [dialogue,setDialogue]=useState<Dialogue|null>(null);
 const [toasts,setToasts]=useState<Toast[]>([]);
 const [ready,setReady]=useState(false);
 const [sceneError,setSceneError]=useState(false);
 const [clock,setClock]=useState(new Date());
 const [zoom,setZoom]=useState(1);
 const [resetConfirm,setResetConfirm]=useState(false);
 const [nameDraft,setNameDraft]=useState(game.name);
 const [saved,setSaved]=useState(true);
 const [fishing,setFishing]=useState<{entity:WorldEntity;start:number}|null>(null);
 const [fishingProgress,setFishingProgress]=useState(0);
 const fishingProgressRef=useRef(0);
 const interactionRef=useRef<(entity:WorldEntity)=>void>(()=>{});
 const fishingRef=useRef<()=>void>(()=>{});
 const toastCounter=useRef(0);
 const timeouts=useRef<ReturnType<typeof setTimeout>[]>([]);
 const notify=useCallback((message:string,positive=true)=>{
  const id=++toastCounter.current;
  setToasts(prev=>[...prev.slice(-2),{id,message,positive}]);
  timeouts.current.push(setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4500));
 },[]);
 const commit=useCallback((next:GameState)=>{gameRef.current=next;setGame(next);},[]);
 const performInteraction=useCallback((entity:WorldEntity)=>{
  const result=interactWith(gameRef.current,entity);
  commit(result.state);
  if(result.kind==='dialogue')setDialogue({speaker:result.speaker??entity.name,message:result.message,animal:animalFor(entity.name)});
  else if(result.kind==='shop')setPanel('shop');
  else if(result.kind==='home')setPanel('home');
  else {notify(result.message,result.kind==='success');if(result.kind==='success'&&gameRef.current.sound)chime();}
 },[commit,notify]);
 interactionRef.current=(entity)=>{
  if(entity.kind==='fish'&&gameRef.current.tool==='rod'&&!gameRef.current.gathered.includes(entity.id))setFishing({entity,start:performance.now()});
  else performInteraction(entity);
 };
 fishingRef.current=()=>{
  if(!fishing)return;
  if(fishingProgressRef.current>=.47&&fishingProgressRef.current<=.78){performInteraction(fishing.entity);setFishing(null);}
  else {notify('That one got away. There are plenty more fish in the sea.',false);setFishing(null);}
 };
 useEffect(()=>{
  if(!containerRef.current)return;
  try {
   const scene=new IslandScene(containerRef.current,{
    initialPlayer:gameRef.current.player,
    onNear:entity=>setNearby(prev=>prev?.id===entity?.id?prev:entity),
    onInteract:entity=>interactionRef.current(entity),
    onMove:player=>{const next={...gameRef.current,player};gameRef.current=next;setGame(next);},
    onReady:()=>setReady(true),
   });
   sceneRef.current=scene;
   scene.sync({...gameRef.current,paused:false});
   return ()=>{scene.destroy();sceneRef.current=null;};
  }catch(error){console.error('Island could not start',error);setSceneError(true);}
 },[]);
 useEffect(()=>{sceneRef.current?.sync({...game,paused:!!panel||!!dialogue||!!fishing});},[game,panel,dialogue,fishing]);
 useEffect(()=>{const timer=setTimeout(()=>setSaved(saveGame(game)),700);return()=>clearTimeout(timer);},[game]);
 useEffect(()=>{
  const save=()=>{saveGame(gameRef.current);};
  window.addEventListener('pagehide',save);
  const clockTimer=setInterval(()=>setClock(new Date()),10000);
  return()=>{window.removeEventListener('pagehide',save);clearInterval(clockTimer);timeouts.current.forEach(clearTimeout);setAmbient(false);};
 },[]);
 useEffect(()=>{
  if(!fishing)return;
  let frame=0;
  const animate=(now:number)=>{const progress=(Math.sin((now-fishing.start)/1000-Math.PI/2)+1)/2;fishingProgressRef.current=progress;setFishingProgress(progress);frame=requestAnimationFrame(animate);};
  frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
 },[fishing]);
 useEffect(()=>{
  const handle=(event:KeyboardEvent)=>{
   if((event.target as HTMLElement)?.matches('input,textarea'))return;
   if(event.key==='Escape'){setPanel(null);setDialogue(null);setFishing(null);setResetConfirm(false);return;}
   if(fishing&&event.code==='Space'){event.preventDefault();fishingRef.current();return;}
   if(dialogue&&(event.key==='Enter'||event.code==='Space')){event.preventDefault();setDialogue(null);return;}
   if(panel||dialogue||fishing)return;
   if(['1','2','3','4'].includes(event.key)){commit({...gameRef.current,tool:tools[Number(event.key)-1]});}
   if(event.key.toLowerCase()==='b')setPanel('pockets');
   if(event.key.toLowerCase()==='m')setPanel('map');
   if(event.key.toLowerCase()==='g')setPanel('guide');
  };
  window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
 },[panel,dialogue,fishing,commit]);
 useEffect(()=>{
  const resume=()=>{if(gameRef.current.sound)setAmbient(true);};
  window.addEventListener('pointerdown',resume,{once:true});
  return()=>window.removeEventListener('pointerdown',resume);
 },[]);
 useEffect(()=>{
  if(!panel&&!dialogue&&!fishing)return;
  const previous=document.activeElement as HTMLElement|null;
  const modal=document.querySelector<HTMLElement>('[role="dialog"]');
  const focusable='button:not(:disabled), input, a[href], [tabindex="0"]';
  const frame=requestAnimationFrame(()=>modal?.querySelector<HTMLElement>(focusable)?.focus());
  const trap=(event:KeyboardEvent)=>{
   if(event.key!=='Tab'||!modal)return;
   const elements=Array.from(modal.querySelectorAll<HTMLElement>(focusable));
   const first=elements[0],last=elements.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first?.focus();}
  };
  window.addEventListener('keydown',trap);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
 },[panel,dialogue,fishing]);
 const totalItems=Object.values(game.inventory).reduce((sum,n)=>sum+n,0);
 const progress=TASKS.filter(task=>game.completed.includes(task.id)).length;
 const open=(next:Panel)=>{setPanel(current=>current===next?null:next);setDialogue(null);setResetConfirm(false);};
 const chooseTool=(tool:Tool)=>{commit({...gameRef.current,tool});};
 const toggleSound=()=>{const enabled=!game.sound;commit({...game,sound:enabled});setAmbient(enabled);if(enabled)chime();};
 const changeZoom=(delta:number)=>{const next=Math.min(2,Math.max(0,zoom+delta));setZoom(next);sceneRef.current?.setCamera((['wide','normal','close'] as const)[next]);};
 const decorate=(kind:DecorationKind)=>{
  const position=sceneRef.current?.getDecorationPosition();
  if(!position){notify('This spot is a little crowded. Try an open patch of grass.',false);return;}
  const result=placeDecoration(game,kind,position);commit(result.state);notify(result.message,result.state!==game);
  if(result.state!==game){setPanel(null);if(game.sound)chime();}
 };
 const rest=()=>{const next=nextDay(game);commit(next);sceneRef.current?.setPlayer(next.player);setPanel(null);notify(`Hello, day ${next.day}! The island has a few fresh surprises.`);};
 const clockTime=clock.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).split(' ');
 const featuredTasks=TASKS.filter(task=>['gathered','met','planted'].includes(task.metric)).slice(0,3);
 const sellValue=(Object.entries(game.inventory) as [ItemId,number][]).reduce((sum,[id,count])=>sum+(id==='flower'?0:ITEM_INFO[id].price*count),0);

 return <div className="app-shell">
  <header className="app-header">
   <a className="brand" href="#" onClick={event=>{event.preventDefault();setPanel(null);}} aria-label="Little Isle home"><span className="brand-icon"><LeafMark/></span><span className="brand-name">little isle<span>a little life, well lived.</span></span></a>
   <span className="header-divider"/>
   <div className="island-name"><span className="status-dot"/>{game.name} Island<ChevronRight size={13}/></div>
   <nav className="main-nav" aria-label="Main navigation">
    <button className={!panel?'active':''} onClick={()=>{setPanel(null);setDialogue(null);}}><Compass size={17}/>My island</button>
    <button className={panel==='pockets'?'active':''} onClick={()=>open('pockets')}><Backpack size={17}/>Pockets<span className="nav-count">{totalItems}</span></button>
    <button className={panel==='guide'?'active':''} onClick={()=>open('guide')}><BookOpen size={17}/>Island guide</button>
   </nav>
   <div className="header-actions"><span className="bell-balance"><span className="coin-symbol">✦</span><span>{game.bells.toLocaleString()}</span><span className="bell-label">bells</span></span><span className="header-divider"/><button className="icon-button sound-button" onClick={toggleSound} aria-label={game.sound?'Mute island sounds':'Enable island sounds'} title={game.sound?'Sound on':'Sound off'}>{game.sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className={`icon-button ${panel==='settings'?'selected':''}`} onClick={()=>open('settings')} aria-label="Settings"><Settings size={19}/></button></div>
  </header>

  <main className={`playground time-${game.timeOfDay}`}>
   <div className="scene-container" ref={containerRef} aria-label="Interactive 3D island. Move with WASD or arrow keys, click to walk, and press E to interact."/>
   {!ready&&!sceneError&&<div className="loading-screen"><LeafMark/><h2>A little island is waking up…</h2><div className="loading-dots"><i/><i/><i/></div></div>}
   {sceneError&&<div className="loading-screen"><LeafMark/><h2>Our island needs a little help.</h2><p>Enable hardware acceleration in your browser, then reload to set sail.</p><button className="primary-button" onClick={()=>window.location.reload()}>Try again</button></div>}
   <div className="island-heading"><span className="eyebrow"><span/> YOUR OWN LITTLE CORNER</span><h1>Life is lovely<br/>on {game.name} Island.</h1><p>Take a breath. Make yourself at home.</p></div>
   <div className="weather-pill">{game.timeOfDay==='night'?<Moon size={21}/>:game.timeOfDay==='sunset'?<Sunset size={21}/>:<Sun size={21}/>}<span>{game.timeOfDay==='night'?'19°':'24°'}<i>{game.timeOfDay==='night'?'Moonlit skies':game.timeOfDay==='sunset'?'Golden hour':'Sunny skies'}</i></span><span className="weather-divider"/><span className="day-label">Day {game.day}</span></div>

   <aside className="island-sidebar">
    <section className="daily-card"><div className="card-heading"><span className="tiny-icon"><Sprout size={18}/></span><h2>Today's little joys</h2><span className="task-count">{progress}/{TASKS.length}</span></div><p>A little something to make your day.</p>
     <div className="daily-tasks">{featuredTasks.map(task=>{
      const done=game.completed.includes(task.id),claimable=taskProgress(game,task)>=task.target;
      return <button className={`daily-task ${done?'done':''}`} key={task.id} onClick={()=>{if(claimable&&!done){const result=claimTask(game,task.id);commit(result.state);notify(result.message);}else open('guide');}}><span className={`task-check ${done?'checked':claimable?'claimable':''}`}>{done?<Check size={12}/>:claimable?<Sparkles size={12}/>:null}</span><span className="task-title">{task.title}<span className="mini-progress"><i style={{width:`${taskProgress(game,task)/task.target*100}%`}}/></span></span><span className="task-fraction">{taskProgress(game,task)}/{task.target}</span></button>;
     })}</div><button className="text-button view-journal" onClick={()=>open('guide')}>Open island journal <ArrowRight size={14}/></button>
    </section>
    <button className="neighbor-note" onClick={()=>{const neighbor=WORLD_ENTITIES.find(e=>e.kind==='villager'&&!game.met.includes(e.name))??WORLD_ENTITIES.find(e=>e.kind==='villager');if(neighbor){sceneRef.current?.setWaypoint(neighbor.x,neighbor.z);notify(`Heading over to ${neighbor.name}. Say hello with E.`,false);}}}><Avatar animal="bear"/><span><span className="note-eyebrow">BETTER TOGETHER</span><strong>A neighbor, a new friend.</strong><span>Someone's waiting to say hello.<ArrowRight size={12}/></span></span></button>
   </aside>

   <div className="world-actions"><button className="round-button" aria-label="Zoom in" title="Zoom in" onClick={()=>changeZoom(1)} disabled={zoom===2}><Plus size={17}/></button><button className="round-button" aria-label="Zoom out" title="Zoom out" onClick={()=>changeZoom(-1)} disabled={zoom===0}><Minus size={17}/></button><span/><button className="round-button" aria-label="How to play" title="How to play" onClick={()=>open('help')}><CircleHelp size={17}/></button></div>

   <div className="island-clock"><div>{clockTime[0]}<span>{clockTime[1]?.toLowerCase()}</span><Sun size={21}/></div><span>{clock.toLocaleDateString('en-US',{month:'long',day:'numeric'})}<i/> {clock.toLocaleDateString('en-US',{weekday:'long'})}</span><p><span className="status-dot"/>{saved?'A little progress, safely saved.':'Save unavailable in this browser.'}</p></div>

   <div className="tool-area">
    {nearby&&!panel&&!dialogue&&!fishing&&<button className="interact-prompt" onClick={()=>sceneRef.current?.interact()}><kbd>E</kbd><span>{nearby.kind==='villager'?`Say hello to ${nearby.name}`:nearby.kind==='tree'?'Shake peach tree':nearby.kind==='fish'?'Cast a line':nearby.kind==='rock'?'Gather stone':nearby.kind==='shop'?'Browse the island market':nearby.kind==='home'?'Make yourself at home':nearby.kind==='shell'?'Pick up seashell':'Catch butterfly'}</span><MousePointer2 size={12}/></button>}
    <div className="tool-dock"><div className="tools">{tools.map((tool,index)=><button key={tool} aria-label={`Equip ${TOOL_INFO[tool].name}`} aria-pressed={game.tool===tool} className={`tool-button ${game.tool===tool?'equipped':''}`} title={`${TOOL_INFO[tool].name} (${index+1})`} onClick={()=>chooseTool(tool)}><span className="tool-number">{index+1}</span><ToolIcon tool={tool}/><span className="tool-tooltip">{TOOL_INFO[tool].name}</span></button>)}</div><span className="dock-divider"/><button className={`decorate-button ${panel==='decorate'?'active':''}`} aria-label="Decorate island" onClick={()=>open('decorate')} title="Make it yours"><Hammer size={23}/><span>Decorate</span></button></div>
    <div className="movement-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to wander</span><i/><span><MousePointer2 size={12}/> click to explore</span><i/><span><kbd>E</kbd> interact</span></div>
   </div>

   <button className="minimap-card" aria-label="Open island map" onClick={()=>open('map')}><div className="minimap-heading"><span><Map size={13}/>{game.name} Island</span><Maximize2 size={12}/></div><IslandMap player={game.player}/><span className="map-caption"><span className="player-dot"/> YOU ARE HERE <kbd>M</kbd></span></button>
   <div className="mobile-controls"><button aria-label="Move north" onClick={()=>sceneRef.current?.setWaypoint(game.player.x,game.player.z-3)}><ArrowUp/></button><div><button aria-label="Move west" onClick={()=>sceneRef.current?.setWaypoint(game.player.x-3,game.player.z)}><ArrowLeft/></button><button aria-label="Move south" onClick={()=>sceneRef.current?.setWaypoint(game.player.x,game.player.z+3)}><ArrowDown/></button><button aria-label="Move east" onClick={()=>sceneRef.current?.setWaypoint(game.player.x+3,game.player.z)}><ArrowRight/></button></div></div>

   <div className="toast-stack" aria-live="polite">{toasts.map(toast=><div className={`toast ${toast.positive?'positive':''}`} key={toast.id}>{toast.positive?<Sparkles size={17}/>:<Leaf size={17}/>}<span>{toast.message}</span><button onClick={()=>setToasts(prev=>prev.filter(t=>t.id!==toast.id))} aria-label="Dismiss notification"><X size={14}/></button></div>)}</div>

   {dialogue&&<div className="dialogue-wrap"><div className="dialogue-card" role="dialog" aria-modal="true" aria-labelledby="speaker-name"><Avatar animal={dialogue.animal}/><div><span className="speaker-tag" id="speaker-name">{dialogue.speaker}</span><p>{dialogue.message}</p><button className="text-button" onClick={()=>setDialogue(null)}>See you around! <ArrowRight size={15}/></button></div><button className="modal-close" onClick={()=>setDialogue(null)} aria-label="Close conversation"><X size={18}/></button></div></div>}

   {fishing&&<div className="modal-backdrop fishing-backdrop"><section className="modal fishing-modal" role="dialog" aria-modal="true" aria-labelledby="fishing-title"><button className="modal-close" onClick={()=>setFishing(null)} aria-label="Stop fishing"><X size={19}/></button><div className="modal-illustration fish-illustration"><Fish size={40}/><span>≈</span></div><span className="eyebrow">A MOMENT OF PATIENCE</span><h2 id="fishing-title">You've got a nibble!</h2><p>Reel it in when the marker reaches the green.</p><div className="fishing-meter" role="meter" aria-label="Fishing timing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fishingProgress*100)} aria-valuetext={fishingProgress>=.47&&fishingProgress<=.78?'Reel now':'Wait for green'}><span className="catch-zone"/><i style={{left:`${fishingProgress*100}%`}}/></div><button className="primary-button" onClick={()=>fishingRef.current()}>Reel it in <kbd>space</kbd></button><small>No hurry. Wait for just the right moment.</small></section></div>}

   {panel&&<div className={`modal-backdrop ${panel==='pockets'||panel==='decorate'?'drawer-backdrop':''}`} onClick={()=>setPanel(null)}><section className={`modal panel-${panel}`} onClick={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="panel-title"><button className="modal-close" onClick={()=>setPanel(null)} aria-label="Close panel"><X size={20}/></button>
    {panel==='pockets'&&<><div className="modal-icon"><Backpack size={24}/></div><span className="eyebrow">A FEW FOUND TREASURES</span><h2 id="panel-title">In your pockets.</h2><p>Little things collected along the way.</p><div className="pocket-summary"><span>{totalItems} items tucked away</span><span><Coins size={14}/>{sellValue.toLocaleString()} bell value</span></div><div className="inventory-grid">{(Object.entries(ITEM_INFO) as [ItemId,typeof ITEM_INFO[ItemId]][]).map(([id,item])=><div key={id} className={`inventory-item ${game.inventory[id]===0?'empty':''}`} title={item.description}><span className="item-emoji">{item.emoji}</span><strong>{item.name}</strong><span>{game.inventory[id]===0?'Not found yet':`× ${game.inventory[id]}`}</span></div>)}</div><div className="soft-note"><Leaf size={17}/><span>A pocketful of possibilities. Flowers can be planted using Decorate.</span></div><button className="primary-button full-width" onClick={()=>setPanel('shop')}>Visit the island market <ArrowRight size={17}/></button></>}
    {panel==='guide'&&<><div className="modal-icon"><BookOpen size={24}/></div><span className="eyebrow">YOUR ISLAND JOURNAL</span><h2 id="panel-title">Little things, lovely days.</h2><p>Settle in at your own pace. Every small adventure counts.</p><div className="journal-summary"><Sprout size={21}/><div><strong>{progress} of {TASKS.length} little joys complete</strong><span>There's no wrong way to spend a day.</span></div><span className="journal-progress">{Math.round(progress/TASKS.length*100)}%</span></div><div className="journal-tasks">{TASKS.map(task=>{const current=taskProgress(game,task),done=game.completed.includes(task.id),claimable=current>=task.target;return <div className={`journal-task ${done?'done':''}`} key={task.id}><div className="journal-task-icon">{done?<CheckCheck size={22}/>:task.metric==='fish'?<Fish size={22}/>:task.metric==='met'?<Heart size={22}/>:task.metric==='planted'?<Flower2 size={22}/>:task.metric==='sold'?<ShoppingBasket size={22}/>:<Leaf size={22}/>}</div><div className="journal-task-copy"><h3>{task.title}</h3><p>{task.description}</p><div className="task-progress"><span style={{width:`${current/task.target*100}%`}}/></div><small>{current} / {task.target}</small></div><button disabled={!claimable||done} className={`reward-button ${claimable&&!done?'claimable':''}`} onClick={()=>{const result=claimTask(game,task.id);commit(result.state);notify(result.message);if(game.sound)chime();}}>{done?<><Check size={13}/>Claimed</>:<><span>✦ {task.reward}</span>{claimable?'Collect':'bells'}</>}</button></div>;})}</div></>}
    {panel==='map'&&<><div className="modal-icon"><Map size={24}/></div><span className="eyebrow">THE WORLD CAN WAIT</span><h2 id="panel-title">Your own little island.</h2><p>Pick a place on the map and take the scenic route.</p><IslandMap player={game.player} large onSelect={(x,z)=>{sceneRef.current?.setWaypoint(x,z);setPanel(null);}}/><div className="map-legend"><span><i className="map-house"/>Your cottage</span><span><i className="map-shop"/>The market</span><span><i className="player-dot"/>You</span></div><div className="landmark-list">{WORLD_ENTITIES.filter(e=>['home','shop','villager'].includes(e.kind)).map(e=><button key={e.id} onClick={()=>{sceneRef.current?.setWaypoint(e.x,e.z);setPanel(null);notify(`A little stroll to ${e.name}.`,false);}}>{e.kind==='home'?<House size={17}/>:e.kind==='shop'?<ShoppingBasket size={17}/>:<Heart size={17}/>}<span>{e.name}</span><ArrowRight size={15}/></button>)}</div></>}
    {panel==='decorate'&&<><div className="modal-icon"><Hammer size={24}/></div><span className="eyebrow">MAKE IT YOURS</span><h2 id="panel-title">A place to put down roots.</h2><p>Add a little charm right where you're standing.</p><div className="decor-list">{(Object.entries(DECORATION_INFO) as [DecorationKind,typeof DECORATION_INFO[DecorationKind]][]).map(([id,item])=><button className="decor-item" key={id} onClick={()=>decorate(id)}><span className="decor-emoji">{item.emoji}</span><span><strong>{item.name}</strong><small>{item.description}</small><span className="decor-price">{id==='flowers'?`1 flower seed · ${game.inventory.flower} in pockets`:`✦ ${item.price.toLocaleString()} bells`}</span></span><Plus size={20}/></button>)}</div><div className="soft-note"><MousePointer2 size={19}/><span>Walk to your favorite spot first, then choose a decoration. A place feels like home one little detail at a time.</span></div><div className="decor-footer"><Flower2 size={16}/>{game.decorations.length} little touches of home</div></>}
    {panel==='shop'&&<><div className="shop-banner"><span className="awning-stripe"/><ShoppingBasket size={37}/><span className="shop-banner-text">THE ISLAND MARKET<small>Good finds. Good neighbors.</small></span></div><span className="eyebrow">A LITTLE SOMETHING LOCAL</span><h2 id="panel-title">Welcome to the market.</h2><p>Trade your treasures for a few bells and a fresh beginning.</p><div className="shop-sell"><div><h3>A pocketful of good finds</h3><p>We'll take fruit, fish, shells, stone, wood, and bugs.<br/>Your flower seeds are yours to keep.</p></div><span className="sell-total">✦ {sellValue.toLocaleString()}<small>bells for your finds</small></span></div><button className="primary-button full-width" disabled={sellValue===0} onClick={()=>{const result=sellItems(game);commit(result.state);notify(result.message);if(game.sound)chime();}}>{sellValue?'Sell collected items':'Come back with a little treasure'}{sellValue>0&&<ArrowRight size={17}/>}</button><h3 className="section-label">FOR A LITTLE GARDEN OF YOUR OWN</h3><div className="seed-product"><span>🌼</span><div><strong>Wildflower seeds</strong><p>A bright little patch of happiness.</p></div><button className="secondary-button" disabled={game.bells<80} onClick={()=>{commit({...game,bells:game.bells-80,inventory:{...game.inventory,flower:game.inventory.flower+3}});notify('Three wildflower seeds, full of possibilities.');}}>3 seeds · ✦ 80</button></div></>}
    {panel==='home'&&<><div className="home-art"><House size={62} strokeWidth={1.2}/><span>✦</span><Sprout size={28}/></div><span className="eyebrow">HOME, SWEET LITTLE HOME</span><h2 id="panel-title">The kettle's always on.</h2><p>Your own cozy corner on {game.name} Island.<br/>A place to rest, recharge, and dream of tomorrow.</p><div className="home-stats"><div><strong>{game.day}</strong><span>island days</span></div><div><strong>{game.met.length}</strong><span>new friends</span></div><div><strong>{game.decorations.length}</strong><span>homey touches</span></div></div><button className="primary-button full-width" onClick={rest}><Moon size={17}/>Rest until tomorrow</button><small className="rest-note">A new day brings fresh fruit, fish, and shells.</small><button className="text-button centered" onClick={()=>setPanel('decorate')}>Make this place a little more you <ArrowRight size={15}/></button></>}
    {panel==='settings'&&<><div className="modal-icon"><Settings size={24}/></div><span className="eyebrow">JUST THE WAY YOU LIKE IT</span><h2 id="panel-title">Island comforts.</h2><p>A few small things to make you feel at home.</p><label className="setting-label" htmlFor="island-name">YOUR ISLAND'S NAME</label><form className="name-form" onSubmit={event=>{event.preventDefault();const name=nameDraft.trim().slice(0,18);if(name){commit({...game,name});notify(`Welcome to ${name} Island.`);}}}><input id="island-name" value={nameDraft} maxLength={18} onChange={event=>setNameDraft(event.target.value)} placeholder="Clover"/><span>Island</span><button type="submit" aria-label="Save island name"><Check size={18}/></button></form><span className="setting-label">SET THE MOOD</span><div className="time-options">{(['day','sunset','night'] as TimeOfDay[]).map(time=><button className={game.timeOfDay===time?'active':''} onClick={()=>commit({...game,timeOfDay:time})} key={time}>{time==='day'?<Sun size={22}/>:time==='sunset'?<Sunset size={22}/>:<Moon size={22}/>}<span>{time==='day'?'Sunny day':time==='sunset'?'Golden hour':'Starry night'}</span></button>)}</div><button className="sound-setting" onClick={toggleSound}><span><Volume2 size={20}/><span>Island sounds<small>A soft little soundtrack for wandering.</small></span></span><span className={`toggle ${game.sound?'on':''}`}><i/></span></button><div className="save-note"><CheckCheck size={17}/><span>{saved?'Your island saves automatically on this browser.':'Local storage is unavailable. Keep this tab open to retain progress.'}</span></div>{resetConfirm?<div className="reset-confirm"><strong>Begin on a brand-new island?</strong><p>Your current island, pockets, and progress will be cleared.</p><button className="secondary-button" onClick={()=>{const next=createNewGame();commit(next);setNameDraft(next.name);sceneRef.current?.setPlayer(next.player);setAmbient(false);setResetConfirm(false);setPanel(null);notify('A fresh little beginning. Welcome home.');}}>Yes, a fresh start</button><button className="text-button" onClick={()=>setResetConfirm(false)}>Keep my island</button></div>:<button className="text-button reset-button" onClick={()=>setResetConfirm(true)}><RotateCcw size={14}/>Start a new island</button>}</>}
    {panel==='help'&&<><div className="modal-icon"><Compass size={24}/></div><span className="eyebrow">NO RUSH. NO RULEBOOK.</span><h2 id="panel-title">Find your island rhythm.</h2><p>A few things to know before you wander.</p><div className="help-rows"><div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Wander around. Arrow keys work too.</span></div><div><MousePointer2 size={23}/><span>Click the ground to walk. Click a tree, neighbor, or building to visit.</span></div><div><kbd>E</kbd><span>Say hello, pick something up, or use your tool.</span></div><div><span><kbd>1</kbd>–<kbd>4</kbd></span><span>Pick a tool. Hands for fruit and shells, net for bugs, rod for fish, shovel for stone.</span></div><div><Hammer size={22}/><span>Decorate your favorite spot with flowers, a bench, or a lantern.</span></div><div><House size={22}/><span>Visit home and rest to begin a new day. The island's resources will return.</span></div></div><button className="primary-button full-width" onClick={()=>setPanel(null)}>Sounds like a lovely day <ArrowRight size={17}/></button></>}
   </section></div>}
  </main>
  <footer className="app-footer"><span><Leaf size={11}/> A little less hurry. A little more happy.</span><span>Made for the moment.<span className="footer-flower">✳</span></span></footer>
 </div>;
}
