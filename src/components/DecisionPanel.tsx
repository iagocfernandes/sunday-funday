import { useEffect, useState } from 'react';
import { CARDS_BY_ID, cardsOfCategory } from '../data/cards';
import { routeHint } from '../data/map';
import { PowerArt } from './PowerCard';
import { ITEMS } from '../data/config';
import { usableActiveItems } from '../game/engine';
import type { Command, GameState, ItemId } from '../game/types';

interface Props {
  state: GameState;
  canResolveDuel?: boolean;
  dispatch: (command: Command) => boolean | Promise<boolean>;
}

/**
 * Uma única decisão ocupa o foco por vez. Toda decisão mostra nome, motivo da
 * pausa e as opções, incluindo Passar quando permitido. Nenhuma expira.
 */
export function DecisionPanel({ state, dispatch, canResolveDuel = true }: Props) {
  const pending = state.pending;
  const [purchase, setPurchase] = useState<ItemId | null>(null);
  const [discardUid, setDiscardUid] = useState('');
  const [bet, setBet] = useState(1);
  const [victim, setVictim] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    setPurchase(null); setDiscardUid(''); setBet(1); setVictim('');
    setCode('');
    setCodeError(null);
  }, [pending?.kind, state.revision]);

  if (!pending) return null;
  const name = (id: string) => state.players[id]?.name ?? '???';

  switch (pending.kind) {
    case 'discardPower': return <Shell title="Escolha um poder para descartar" why={`Você recebeu ${ITEMS[pending.incoming.itemId].name}. Limite: 3 poderes.`}><div className="options">{state.players[pending.playerId].inventory.map(i=><button key={i.uid} onClick={()=>void dispatch({type:'discardPower',uid:i.uid})}>{ITEMS[i.itemId].name}</button>)}</div></Shell>;
    case 'iagugu': {
      const actor=state.players[pending.playerId]; const target=state.players[victim];
      return <Shell title="Iagugu · o macaquito ladrão" why="Uma ação por visita. Escolha quem vai perder moedas ou uma banana.">
        <p>Seu saldo: {actor.common} moedas. Roubar moedas é grátis; banana custa 40.</p>
        <div className="options">{state.order.filter(id=>id!==actor.id).map(id=><button key={id} className="option-card" aria-pressed={victim===id} onClick={()=>setVictim(id)}><strong>{victim===id?'✓ ':''}{name(id)}</strong><small>{state.players[id].common} moedas · {state.players[id].golden} bananas</small></button>)}</div>
        <div className="options">
          <button className="option-card" disabled={!target || target.common<1} onClick={()=>void dispatch({type:'rob',targetId:victim,currency:'common'})}>Roubar até 10 moedas · grátis</button>
          <button className="option-card" disabled={!target || target.golden<1 || actor.common<40} onClick={()=>void dispatch({type:'rob',targetId:victim,currency:'golden'})}>Roubar 1 banana · pagar 40 moedas</button>
          <button className="option-card" onClick={()=>void dispatch({type:'skipIagugu'})}>Passar sem roubar</button>
        </div>
      </Shell>;
    }
    case 'duelBet': return <Shell title={`Duelo: ${name(pending.playerId)} × ${name(pending.opponentId)}`} why="O adversário foi sorteado. Escolha quanto vale a disputa.">
      {pending.maxBet>0 ? <><p>O vencedor recebe a aposta do perdedor. Limite: {pending.maxBet} moedas.</p><label>Aposta em moedas<input aria-label="Aposta em moedas" type="number" inputMode="numeric" min="1" max={pending.maxBet} value={bet} onChange={e=>setBet(Number(e.target.value))}/></label></> : <p>Sem saldo dos dois lados para apostar: este duelo será amistoso, sem transferência de moedas.</p>}
      <button className="btn-primary" disabled={pending.maxBet>0 && (!Number.isInteger(bet)||bet<1||bet>pending.maxBet)} onClick={()=>void dispatch({type:'setDuelBet',amount:pending.maxBet>0?bet:0})}>Confirmar e disputar</button>
    </Shell>;
    case 'duelResult': return <Shell title={`⚔ Duelo: ${name(pending.playerId)} × ${name(pending.opponentId)}`} why={pending.allIn?'TUDO OU NADA: o vencedor recebe todas as moedas do perdedor.':`Valendo ${pending.bet} moedas. Façam uma prova rápida combinada com o anfitrião.`}>
      {canResolveDuel ? <><p>Registre o resultado após a prova presencial:</p><div className="options">{[pending.playerId,pending.opponentId].map(id=><button key={id} className="option-card" onClick={()=>void dispatch({type:'resolveDuel',winnerId:id})}>{name(id)} venceu</button>)}<button className="option-card" onClick={()=>void dispatch({type:'resolveDuel',winnerId:null})}>Empate</button></div></> : <p>Aguardando o anfitrião registrar o resultado na TV.</p>}
    </Shell>;

    case 'harvest': return <Shell title="Você colheu uma banana dourada!" why={`A próxima está na ${state.map.stops?.find(s => s.id === pending.nextTreeId)?.name ?? pending.nextTreeId}.`}>
      <div className="harvest-fruit">🍌</div><button className="btn-primary" onClick={() => void dispatch({ type: 'continueHarvest' })}>Continuar o caminho · {state.movement?.remaining ?? 0} casa(s)</button>
    </Shell>;
    case 'chooseDice': return <Shell title="Escolha seu dado" why="Escolha o resultado. Depois confirme a rolagem.">
      <div className="options">{Array.from({ length: state.config.diceMax - state.config.diceMin + 1 }, (_, i) => i + state.config.diceMin).map(value => <button key={value} className="option-card" onClick={() => void dispatch({ type: 'chooseDice', value })}>{value}</button>)}</div>
    </Shell>;
    case 'stealItem': return <Shell title="De quem pegar um poder?" why="O sistema sorteia um dos poderes dessa pessoa.">
      <div className="options">{pending.candidates.map(id => <button key={id} className="option-card" onClick={() => void dispatch({ type: 'stealItem', targetId: id })}>{name(id)} · {state.players[id].inventory.length} poder(es)</button>)}</div>
    </Shell>;
    case 'itemChoice': {
      const player = state.players[pending.playerId];
      const items = usableActiveItems(state, player);
      return (
        <Shell title={`${player.name}: qual item usar?`} why="Use um poder ou siga para o dado. Escolha no seu tempo.">
          <div className="options">
            {items.map((item) => (
              <button key={item.uid} className="option-card power-option" onClick={() => dispatch({ type: 'useItem', uid: item.uid })}>
                <PowerArt itemId={item.itemId}/><strong>{ITEMS[item.itemId].name}</strong>
                <small>{ITEMS[item.itemId].description}</small>
              </button>
            ))}
            <button className="option-card" onClick={() => dispatch({ type: 'cancelItemChoice' })}>
              <strong>Não usar item</strong>
              <small>Segue direto para o dado. A janela não recomeça.</small>
            </button>
          </div>
        </Shell>
      );
    }

    case 'path':
      return (
        <Shell
          title={`${name(pending.playerId)} decide: qual caminho?`}
          why="Bifurcação no mapa. Clique na casa destacada ou escolha abaixo."
        >
          <div className="options">
            {pending.options.map((nodeId) => (
              <button key={nodeId} className="option-card" onClick={() => dispatch({ type: 'choosePath', nodeId })}>
                <strong>{state.map.stops ? routeHint(state.map, state.players[pending.playerId].nodeId, nodeId) : state.map.nodes[nodeId].label ?? describeNode(state, nodeId)}</strong>
                <small>{pathHint(state, nodeId)}</small>
              </button>
            ))}
          </div>
        </Shell>
      );

    case 'shop': {
      const buyer = state.players[pending.playerId];
      return (
        <Shell
          title={state.map.stops?.find(s => s.id === pending.nodeId)?.name ?? `${buyer.name} na loja`}
          why={`Saldo: ${buyer.common} 🪙 · Inventário ${buyer.inventory.length}/${state.config.inventoryLimit}`}
        >
          <div className="options">
            {!purchase && pending.items.map((itemId) => (
              <button key={itemId} className="option-card power-option" disabled={buyer.common < ITEMS[itemId].price} onClick={() => { setPurchase(itemId); setDiscardUid(''); }}>
                <PowerArt itemId={itemId}/><strong>{ITEMS[itemId].name} · {ITEMS[itemId].price} moedas</strong>
                <small>{ITEMS[itemId].description}</small>
              </button>
            ))}
            {purchase && <div className="purchase-confirm">
              <h3>Comprar {ITEMS[purchase].name}?</h3>
              <p>Preço: {ITEMS[purchase].price} moedas · Saldo depois: {buyer.common - ITEMS[purchase].price}</p>
              {buyer.inventory.length >= state.config.inventoryLimit && <>
                <p>Você tem três poderes. Escolha um para descartar:</p>
                {buyer.inventory.map(item => <button key={item.uid} aria-pressed={discardUid === item.uid} onClick={() => setDiscardUid(item.uid)}>{discardUid === item.uid ? '✓ ' : ''}{ITEMS[item.itemId].name}</button>)}
              </>}
              <button className="btn-primary" disabled={buyer.inventory.length >= state.config.inventoryLimit && !discardUid} onClick={() => void dispatch({ type: 'buyItem', itemId: purchase, ...(discardUid ? { discardUid } : {}) })}>Confirmar compra</button>
              <button onClick={() => { setPurchase(null); setDiscardUid(''); }}>Cancelar compra</button>
            </div>}
            <button className="option-card" onClick={() => dispatch({ type: 'skipShop' })}>
              <strong>Passar</strong>
              <small>Não comprar nada. Nada é cobrado.</small>
            </button>
          </div>
        </Shell>
      );
    }

    case 'pedestal': {
      const buyer = state.players[pending.playerId];
      return (
        <Shell
          title={`${buyer.name}: colher a banana dourada?`}
          why={`Custa ${pending.price} 🪙. Saldo atual: ${buyer.common} 🪙. Máximo de uma dourada por turno.`}
        >
          <div className="options">
            <button className="option-card btn-primary" onClick={() => dispatch({ type: 'buyGolden' })}>
              <strong>Colher (−{pending.price} 🪙)</strong>
              <small>Outra árvore dará fruto depois da colheita.</small>
            </button>
            <button className="option-card" onClick={() => dispatch({ type: 'skipPedestal' })}>
              <strong>Passar</strong>
              <small>Guardar as moedas para depois.</small>
            </button>
          </div>
        </Shell>
      );
    }

    case 'cardCode': {
      const holder = state.players[pending.playerId];
      const deck = pending.category === 'luck' ? 'SORTE' : 'AZAR';
      const eligible = cardsOfCategory(pending.category);
      return (
        <Shell
          title={`${holder.name} comprou uma carta de ${deck}`}
          why="Pegue a carta física do baralho correto e informe o código. Cartas de item não valem como carta de sorte."
        >
          <form
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            onSubmit={async (event) => {
              event.preventDefault();
              if (!await dispatch({ type: 'submitCardCode', code })) {
                setCodeError('Código não encontrado neste baralho.');
              }
            }}
          >
            <input
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
              placeholder={pending.category === 'luck' ? 'S01' : 'A01'}
              aria-label="Código da carta física"
              style={{ textTransform: 'uppercase', width: 140 }}
            />
            <button className="btn-primary" type="submit">Buscar</button>
            {codeError && <span style={{ color: 'var(--red)' }}>{codeError}</span>}
          </form>
          <div className="options">
            {eligible.map((card) => (
              <button
                key={card.id}
                className="option-card"
                onClick={() => dispatch({ type: 'submitCardCode', code: card.code })}
              >
                <strong>{card.code} — {card.title}</strong>
                <small>{card.description}</small>
              </button>
            ))}
          </div>
        </Shell>
      );
    }

    case 'cardPreview': {
      const card = CARDS_BY_ID[pending.cardId];
      if(state.config.cardMode==='digital')return <Shell title={card.title} why={card.description}><p>Acompanhe a TV. O efeito será aplicado automaticamente.</p></Shell>;
      return (
        <Shell title={`Confirmar: ${card.title}`} why={`${name(pending.playerId)} · ${card.description}`}>
          <div className="options">
            <button className="option-card btn-primary" onClick={() => dispatch({ type: 'confirmCard' })}>
              <strong>Aplicar efeito</strong>
              <small>O efeito é aplicado uma única vez.</small>
            </button>
            {state.config.cardMode === 'physical' && <button className="option-card" onClick={() => dispatch({ type: 'cancelCard' })}>
              <strong>Voltar</strong>
              <small>Informar outro código.</small>
            </button>}
          </div>
        </Shell>
      );
    }

    case 'target':
      return (
        <Shell
          title={`${name(pending.playerId)} escolhe o alvo`}
          why={pending.source.type==='card'?CARDS_BY_ID[pending.source.cardId].description:state.players[pending.playerId].inventory.find(i=>i.uid===(pending.source as {uid:string}).uid)?.itemId==='preguicao'?'O próximo dado do escolhido ficará entre 1 e 3.':`O alvo perde até ${pending.amount} moedas. Pode haver defesa.`}
        >
          <div className="options">
            {pending.candidates.map((id) => (
              <button key={id} className="option-card" onClick={() => dispatch({ type: 'chooseTarget', targetId: id })}>
                <strong>{state.players[id].symbol} {state.players[id].name}</strong>
                <small>{state.players[id].common} 🪙 · {state.players[id].inventory.length} item(ns)</small>
              </button>
            ))}
            <button className="option-card" onClick={() => dispatch({ type: 'cancelTarget' })}>
              <strong>Desistir</strong>
              <small>A ação é encerrada sem escolher um alvo.</small>
            </button>
          </div>
        </Shell>
      );

    case 'defense': {
      const target = state.players[pending.targetId];
      return (
        <Shell
          title={`${target.name} pode se defender`}
          why={`Ataque de ${name(pending.attackerId)} valendo ${pending.amount} 🪙. Bloqueio consome o item e não transfere nada.`}
        >
          <div className="options">
            {pending.options.map((item) => (
              <button
                key={item.uid}
                className="option-card"
                onClick={() =>
                  dispatch({
                    type: 'resolveDefense',
                    choice: item.itemId === 'escudo' ? 'block' : 'reverse',
                    uid: item.uid,
                  })
                }
              >
                <PowerArt itemId={item.itemId}/><strong>{ITEMS[item.itemId].name}</strong>
                <small>
                  {item.itemId === 'escudo'
                    ? 'Bloqueia: ninguém perde moedas. Item consumido.'
                    : 'Devolve o ataque ao atacante. Não gera nova corrente.'}
                </small>
              </button>
            ))}
            <button className="option-card" onClick={() => dispatch({ type: 'resolveDefense', choice: 'none' })}>
              <strong>Recusar defesa</strong>
              <small>Aceitar o ataque e perder as moedas.</small>
            </button>
          </div>
        </Shell>
      );
    }
  }
}

/** Mostra o que vem logo à frente daquele caminho, em vez do id do nó. */
function pathHint(state: GameState, nodeId: string): string {
  const seen = new Set<string>();
  const ahead: string[] = [];
  let current = nodeId;
  for (let i = 0; i < 3; i++) {
    const node = state.map.nodes[current];
    if (!node || seen.has(current)) break;
    seen.add(current);
    ahead.push(describeNode(state, current));
    current = node.next[0];
  }
  return `A seguir: ${ahead.join(' → ')}`;
}

function describeNode(state: GameState, nodeId: string): string {
  const node = state.map.nodes[nodeId];
  const kinds: Record<string, string> = {
    plus: `Casa boa (+${state.config.plusAmount})`,
    minus: `Casa ruim (−${state.config.minusAmount})`,
    luck: 'Casa de sorte',
    unluck: 'Casa de azar',
    shop: 'Loja',
    pedestal: 'Pedestal',
    thief: 'Esconderijo do ladrão',
    blank: 'Passagem',
    start: 'Início',
  };
  return kinds[node.kind] ?? 'Casa';
}

function Shell({ title, why, children }: { title: string; why: string; children: React.ReactNode }) {
  return (
    <section className="decision" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <p className="why">{why}</p>
      {children}
    </section>
  );
}
