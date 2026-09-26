import type { CSSProperties } from 'react';

export function LeafMark({className = ''}:{className?: string}) {
 return <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M11 29C6 17 16 6 35 7c2 17-6 27-19 25L28 15 11 29Z" fill="currentColor"/><path d="m9 37 18-22" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}
export function ToolIcon({tool, size=30}:{tool:string;size?:number}) {
 const common = {width:size,height:size,viewBox:'0 0 40 40',fill:'none','aria-hidden':true as const};
 if(tool==='hand') return <svg {...common}><path d="m11 23 1-12c.4-3 4-2 4 0v7l2-12c.4-3 4-2 4 1l-.5 11 3-11c1-3 4-1 3.5 1l-2 12 4-8c1-2 4-1 3 2l-5 16c-2 7-12 9-16 3L5 22c-2-3 1-5 3-3l3 4Z" fill="#ecd1a4" stroke="#927856" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
 if(tool==='net') return <svg {...common}><path d="m10 36 14-21" stroke="#9d7149" strokeWidth="4" strokeLinecap="round"/><path d="m25 4 10 6-10 16-10-7Z" fill="#e0f1e5"/><path d="m18 15 13 4m-10-9 12 5m-9-7-5 14m9-12-5 14" stroke="#8caf9a" strokeWidth="1"/><ellipse cx="25" cy="10" rx="11" ry="6" transform="rotate(-54 25 10)" stroke="#5e8270" strokeWidth="2"/></svg>;
 if(tool==='rod') return <svg {...common}><path d="M9 36 23 5" stroke="#a78255" strokeWidth="3" strokeLinecap="round"/><path d="M23 5q13 3 10 19v5q0 6-5 2" stroke="#78938a" strokeWidth="1.5" strokeLinecap="round"/><path d="m7 36 4-8" stroke="#567361" strokeWidth="5" strokeLinecap="round"/><circle cx="15" cy="26" r="3" fill="#b9c5aa" stroke="#557461" strokeWidth="1.5"/><ellipse cx="33" cy="23" rx="2" ry="3" fill="#da8968"/></svg>;
 return <svg {...common}><path d="m23 8-9 20" stroke="#b38b57" strokeWidth="4"/><path d="m17 24-8-4-4 10q-2 8 6 7l8-9Z" fill="#9aaeb0" stroke="#69888a" strokeWidth="1.5"/><path d="m20 3 10 4-4 8-9-4 3-8Z" fill="#b48f61" stroke="#8d6d47" strokeWidth="2" strokeLinejoin="round"/></svg>;
}
export function Avatar({animal='fox',small=false}:{animal?:string;small?:boolean}) {
 const fox=animal==='fox', rabbit=animal==='rabbit', duck=animal==='duck';
 return <span className={`animal-avatar ${small?'small':''}`} style={{'--avatar-bg':fox?'#f0d6a8':rabbit?'#e9dce9':duck?'#ede5ba':'#d9e2c7'} as CSSProperties}><svg viewBox="0 0 60 60" fill="none" aria-hidden="true">{!duck&&<path d={rabbit?'M16 27 12 5q8-5 13 18m9 0q4-28 12-18l-2 24':fox?'m10 29 2-21 16 14m5-1L49 8l2 23':'M17 26C-1 16 15 4 23 20m15 1C46 3 62 20 45 28'} fill={fox?'#c98756':rabbit?'#e9c1b2':'#997d63'}/>}<ellipse cx="30" cy="34" rx="22" ry="21" fill={fox?'#d79a64':rabbit?'#f4ddce':duck?'#e6c975':'#b39b7b'}/>{fox&&<path d="M8 31q11-6 22 11 10-17 22-11-2 22-22 23C16 54 9 45 8 31Z" fill="#fff0d2"/>}<ellipse cx="30" cy={duck?'41':'44'} rx="11" ry={duck?'5':'9'} fill={fox?'#fff0d2':rabbit?'#fff1dd':duck?'#d89560':'#e9d9b7'}/><ellipse cx="22" cy="33" rx="2" ry="3" fill="#4e5140"/><ellipse cx="38" cy="33" rx="2" ry="3" fill="#4e5140"/><path d="m27 40 3 3 3-3Z" fill="#635043"/><path d="M26 46q4 4 8 0" stroke="#6c6751" strokeWidth="1.2" strokeLinecap="round"/><ellipse cx="16" cy="40" rx="3" ry="2" fill="#df9f88"/><ellipse cx="44" cy="40" rx="3" ry="2" fill="#df9f88"/></svg></span>;
}
