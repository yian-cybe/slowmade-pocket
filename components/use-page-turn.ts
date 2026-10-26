import { useEffect, useRef, useState } from 'react';

export function usePageTurn() {
 const [motion,setMotion]=useState('');
 const locked=useRef(false),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);},[]);
 function turn(action:()=>void,direction:'forward'|'backward'='forward') {
  if(locked.current)return;
  const reveal=()=>{action();window.scrollTo({top:0,behavior:'auto'});};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){reveal();return;}
  locked.current=true;setMotion(direction+'-out');
  timers.current=[setTimeout(()=>{reveal();setMotion(direction+'-in');},160),setTimeout(()=>{setMotion('');locked.current=false;},540)];
 }
 return {turn,motion};
}
