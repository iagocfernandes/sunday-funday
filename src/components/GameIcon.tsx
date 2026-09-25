import {useId} from 'react';

/** Small code-native icons stay crisp at TV and phone sizes. */
export function GameIcon({kind}:{kind:'banana'|'coin'|'luck'|'unluck'}){
 const id=useId().replace(/:/g,'');
 return <svg viewBox="0 0 32 32" aria-hidden="true" style={{width:'1.2em',height:'1.2em',display:'inline-block',verticalAlign:'-.2em',flexShrink:0}}>
  <defs><linearGradient id={id} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#fff3ac"/><stop offset=".45" stopColor="#ffd12b"/><stop offset="1" stopColor="#d28b05"/></linearGradient></defs>
  {kind==='coin'?<><circle cx="16" cy="17" r="13" fill="#aa6a03"/><circle cx="16" cy="15" r="12" fill={`url(#${id})`} stroke="#fbe280" strokeWidth="1.5"/><circle cx="16" cy="15" r="8.8" fill="none" stroke="#bb820b"/><path d="M18 8l-5 8h5l-4 7" fill="none" stroke="#805607" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></>
   :kind==='banana'?<><path d="M6 7C3 18 12 27 24 18c2-2 3-5 3-8 4 13-4 21-14 19C4 27 0 18 4 8Z" fill={`url(#${id})`} stroke="#bd830b" strokeWidth="1"/><path d="M7 13c1 9 11 12 17 4" fill="none" stroke="#fff2ac" strokeWidth="1.5"/><path d="M4 8l1-4 3 1-1 4M26 11l1-4 2 1-1 4" fill="#886124"/></>
   :kind==='luck'?<g fill="#269869"><circle cx="11" cy="10" r="6"/><circle cx="22" cy="10" r="6"/><circle cx="11" cy="21" r="6"/><circle cx="22" cy="21" r="6"/><path d="M16 18h3l-1 12h-3Z"/></g>
   :<path d="M18 2 6 19h10l-3 12 14-19H17Z" fill="#a361c2" stroke="#e4c5f5" strokeWidth="1"/>}
 </svg>;
}
