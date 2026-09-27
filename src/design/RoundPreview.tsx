import { useState } from 'react';
import { MinigamePanel } from '../components/MinigamePanel';
import { BoardTutorial } from '../remote/BoardTutorial';
import { applyCommand, createGame, minigameForRound } from '../game/engine';
import { DEFAULT_COLORS } from '../data/config';
import type { Command } from '../game/types';
import type { BoardTutorial as TutorialState } from '../remote/types';
import './round-preview.css';

function fixture(round = 1, count = 7) {
  const names = ['Iago', 'Milena', 'Emiliano', 'Mari', 'Arthur', 'Fabi', 'Matheus', 'AR2', 'Bia', 'Lucas'];
  const game = createGame(names.slice(0, count).map((name, index) => ({ id: `p${index}`, name, color: DEFAULT_COLORS[index], symbol: '●', portrait: `/assets/characters/${index % 2 ? 'milena' : 'arthur'}-v1.png` })), {}, { seed: 71, shuffleOrder: false });
  game.round = round;
  game.phase = 'turnEnd';
  game.activeIndex = count - 1;
  return applyCommand(game, { commandId: crypto.randomUUID(), expectedRevision: game.revision, command: { type: 'endTurn' } }).state;
}

export function RoundPreview() {
  const [state, setState] = useState(() => fixture());
  const [count, setCount] = useState(7);
  const [error, setError] = useState('');
  const [tutorial, setTutorial] = useState<TutorialState | null>(null);
  function dispatch(command: Command) {
    const result = applyCommand(state, { commandId: crypto.randomUUID(), expectedRevision: state.revision, command });
    if (result.rejected) { setError(result.rejected); return false; }
    setError(''); setState(result.state); return true;
  }
  return <section className="round-preview">
    <h1>Ensaio das 10 rodadas</h1>
    <p>Prévia isolada. Pode confirmar prêmios aqui sem alterar nenhuma partida.</p>
    <div className="round-preview__controls">
      <label>Participantes <select value={count} onChange={event => { const next = Number(event.target.value); setCount(next); setState(fixture(state.round, next)); }}><option value={7}>7 jogadores</option><option value={10}>10 jogadores · testar Coup</option></select></label>
      <label>Rodada <select value={state.round} onChange={event => { setState(fixture(Number(event.target.value), count)); setError(''); }}>{state.config.minigameOrder.map((_, index) => <option key={index} value={index + 1}>{index + 1} · {minigameForRound(state, index + 1).name}</option>)}</select></label>
      <button onClick={() => setTutorial({ pending: true, step: 0, completed: false, replay: true })}>Ver tutorial de abertura</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="round-preview__panel"><MinigamePanel state={state} dispatch={dispatch}/></div>
    {state.phase === 'roundEnd' && <div className="card-panel"><h2>Prêmio registrado</h2><p>{state.results.at(-1)?.detail}</p><div className="reward-preview">{state.order.map(id => <span className="reward-chip" key={id}>{state.players[id].name}: {state.players[id].common} moedas · {state.players[id].golden} bananas</span>)}</div><button onClick={() => setState(fixture(state.round, count))}>Repetir esta prova</button></div>}
    {tutorial && <BoardTutorial state={state} tutorial={tutorial} matchId="round-preview" busy={false} act={async command => { if (command.type !== 'tutorial') return false; if (command.action === 'skip' || (command.action === 'next' && tutorial.step === 3)) setTutorial(null); else setTutorial({ ...tutorial, step: Math.max(0, tutorial.step + (command.action === 'back' ? -1 : 1)) }); return true; }}/>}
  </section>;
}
