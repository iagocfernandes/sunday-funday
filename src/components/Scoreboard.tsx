import { minigameForRound, ranking } from '../game/engine';
import type { GameState } from '../game/types';
import { PlayerPortrait } from './PlayerPortrait';

export function Scoreboard({ state }: { state: GameState }) {
  const rows = ranking(state);
  const activeId = state.order[state.activeIndex];
  let position = 0;
  let lastKey = '';
  let lastPosition = 0;

  return (
    <div className="card-panel">
      <h3>Classificação</h3>
      <table className="scoreboard">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Gorila</th>
            <th scope="col" className="num">Moedas</th>
            <th scope="col" className="num">Douradas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => {
            position += 1;
            const key = `${player.golden}/${player.common}`;
            const shown = key === lastKey ? lastPosition : position;
            lastKey = key;
            lastPosition = shown;
            return (
              <tr key={player.id} className={player.id === activeId ? 'active' : undefined}>
                <td>{shown}</td>
                <td>
                  <div className="player-cell">
                    <PlayerPortrait className="avatar" src={player.portrait} alt="" style={{ borderColor: player.color }} />
                    <span className="sym" style={{ color: player.color }}>{player.symbol}</span>
                    <span>{player.name}</span>
                  </div>
                </td>
                <td className="num">🪙 {player.common}</td>
                <td className="num">🍌 {player.golden}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NextMinigame({ state }: { state: GameState }) {
  const game = minigameForRound(state, state.round);
  return (
    <div className="card-panel">
      <h3>Minigame da rodada</h3>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <span style={{ fontSize: '2rem' }}>{game.icon}</span>
        <div>
          <strong style={{ fontSize: '1.15rem' }}>{game.name}</strong>
          <div style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>Após todos jogarem</div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel({ state }: { state: GameState }) {
  return (
    <div className="card-panel">
      <h3>Histórico</h3>
      <div className="history">
        {state.history.map((entry) => (
          <div key={entry.id} className={entry.kind}>
            R{entry.round} · {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
