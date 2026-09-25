import type { CSSProperties } from 'react';
import { ITEMS } from '../data/config';
import type { ItemId } from '../game/types';
import './power-card.css';

const positions: Partial<Record<ItemId, string>> = {
  dadoDuplo:'0% 0%', dadoCerteiro:'50% 0%', trocaTroca:'100% 0%',
  mudaBanana:'0% 100%', preguicao:'50% 100%', blindado:'100% 100%',
};

/** Original art sheet, framed by CSS without duplicating six large raster files. */
export function PowerArt({itemId}: {itemId: ItemId}) {
  if(itemId==='mudaBanana')return <span aria-hidden="true" className="power-art power-art-fabio"/>;
  const position = positions[itemId];
  return position
    ? <span aria-hidden="true" className="power-art" style={{'--power-position':position} as CSSProperties}/>
    : <span aria-hidden="true" className="power-art power-art-legacy">{ITEMS[itemId].icon}</span>;
}

export function PowerCard({itemId}: {itemId: ItemId}) {
  const item=ITEMS[itemId];
  return <article className="power-card">
    <header><small>SUNDAY FUNDAY · PODER</small><h3>{item.name}</h3></header>
    <PowerArt itemId={itemId}/>
    <div className="power-card-copy"><p>{item.description}</p><strong>{item.price} moedas</strong>
    <small>{item.usage==='defensive'?'Proteção automática':'Use antes do dado'}</small></div>
  </article>;
}
