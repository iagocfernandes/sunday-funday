import { useEffect, useState } from 'react';
import { CARDS_BY_ID, cardsOfCategory } from '../data/cards';
import { ITEMS } from '../data/config';
import { usableActiveItems } from '../game/engine';
import type { Command, GameState } from '../game/types';

interface Props {
  state: GameState;
  dispatch: (command: Command) => boolean;
}

/**
 * Uma única decisão ocupa o foco por vez. Toda decisão mostra nome, motivo da
 * pausa e as opções, incluindo Passar quando permitido. Nenhuma expira.
 */
export function DecisionPanel({ state, dispatch }: Props) {
  const pending = state.pending;
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    setCode('');
    setCodeError(null);
  }, [pending?.kind, state.revision]);

  if (!pending) return null;
  const name = (id: string) => state.players[id]?.name ?? '???';

  switch (pending.kind) {
    case 'itemChoice': {
      const player = state.players[pending.playerId];
      const items = usableActiveItems(state, player);
      return (
        <Shell title={`${player.name}: qual item usar?`} why="A janela de 5 s foi suspensa. Esta decisão não expira.">
          <div className="options">
            {items.map((item) => (
              <button key={item.uid} className="option-card" onClick={() => dispatch({ type: 'useItem', uid: item.uid })}>
                <strong>{ITEMS[item.itemId].icon} {ITEMS[item.itemId].name}</strong>
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
                <strong>{state.map.nodes[nodeId].label ?? describeNode(state, nodeId)}</strong>
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
          title={`${buyer.name} na loja`}
          why={`Saldo: ${buyer.common} 🪙 · Inventário ${buyer.inventory.length}/${state.config.inventoryLimit}`}
        >
          <div className="options">
            {pending.items.map((itemId) => (
              <button key={itemId} className="option-card" onClick={() => dispatch({ type: 'buyItem', itemId })}>
                <strong>{ITEMS[itemId].icon} {ITEMS[itemId].name} — {ITEMS[itemId].price} 🪙</strong>
                <small>{ITEMS[itemId].description}</small>
              </button>
            ))}
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
          title={`${buyer.name} decide: comprar a banana dourada?`}
          why={`Custa ${pending.price} 🪙. Saldo atual: ${buyer.common} 🪙. Máximo de uma dourada por turno.`}
        >
          <div className="options">
            <button className="option-card btn-primary" onClick={() => dispatch({ type: 'buyGolden' })}>
              <strong>Comprar (−{pending.price} 🪙)</strong>
              <small>O pedestal muda de lugar depois da compra.</small>
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
            onSubmit={(event) => {
              event.preventDefault();
              if (!dispatch({ type: 'submitCardCode', code })) {
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
      return (
        <Shell title={`Confirmar: ${card.title}`} why={`${name(pending.playerId)} · ${card.description}`}>
          <div className="options">
            <button className="option-card btn-primary" onClick={() => dispatch({ type: 'confirmCard' })}>
              <strong>Aplicar efeito</strong>
              <small>O efeito é aplicado uma única vez.</small>
            </button>
            <button className="option-card" onClick={() => dispatch({ type: 'cancelCard' })}>
              <strong>Voltar</strong>
              <small>Informar outro código.</small>
            </button>
          </div>
        </Shell>
      );
    }

    case 'target':
      return (
        <Shell
          title={`${name(pending.playerId)} escolhe o alvo`}
          why={`O alvo perde até ${pending.amount} moedas. Pode haver defesa.`}
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
              <small>Nada é consumido.</small>
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
                <strong>{ITEMS[item.itemId].icon} {ITEMS[item.itemId].name}</strong>
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
