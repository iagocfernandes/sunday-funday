import { useEffect } from 'react';
let scrollOwners=0;
/** A TV mantém viewport fixo; entrada e controle móvel usam rolagem do documento. */
export function usePageScroll(enabled:boolean){
  useEffect(()=>{
    if(!enabled)return;
    scrollOwners++;
    document.documentElement.classList.add('remote-scroll-page');
    return()=>{scrollOwners--;if(scrollOwners===0)document.documentElement.classList.remove('remote-scroll-page');};
  },[enabled]);
}
