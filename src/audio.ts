let context: AudioContext | undefined;
let ambientTimer: ReturnType<typeof setInterval> | undefined;
function getContext() { context ??= new AudioContext(); if(context.state==='suspended') void context.resume(); return context; }
function note(frequency:number, at:number, duration:number, volume:number, type:OscillatorType='sine') {
 const ctx=getContext(),osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type; osc.frequency.value=frequency; gain.gain.setValueAtTime(0,ctx.currentTime+at); gain.gain.linearRampToValueAtTime(volume,ctx.currentTime+at+.02); gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+duration); osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+at);osc.stop(ctx.currentTime+at+duration);
}
export function chime(){[523.25,659.25,783.99].forEach((f,i)=>note(f,i*.1,.6,.035));}
export function setAmbient(enabled:boolean){
 if(ambientTimer){clearInterval(ambientTimer);ambientTimer=undefined;}
 if(!enabled)return;
 getContext();const notes=[261.63,329.63,392,440,523.25,659.25];let step=0;
 const play=()=>{note(notes[[0,2,1,4,3,2,5,1][step++%8]],0,2.5,.017,'sine');};
 play();ambientTimer=setInterval(play,2200);
}
