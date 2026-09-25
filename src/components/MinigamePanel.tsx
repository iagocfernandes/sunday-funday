import { useMemo, useState } from 'react';
import { MINIGAMES } from '../data/config';
import { autoTeams, minigameForRound } from '../game/engine';
import {
  boxPositions,
  describePlacement,
  individualAwards,
  normalizePlacement,
} from '../game/placements';
import type { Command, GameState } from '../game/types';

interface Props {
  state: GameState;
  dispatch: (command: Command) => boolean;
}

/**
 * Prova presencial: o jogo fica parado nesta tela enquanto as pessoas jogam.
 * A premiação é aplicada em uma única operação, uma única vez.
 */
export function MinigamePanel({ state, dispatch }: Props) {
  const game = minigameForRound(state, state.round);
  const def = MINIGAMES.find((m) => m.id === (state.minigame?.minigameId ?? game.id)) ?? game;
  const teams = state.minigame?.teams ?? [];
  // Três caixas fixas; a posição competitiva de cada uma é derivada, não é o índice.
  const [tiers, setTiers] = useState<string[][]>([[], [], []]);
  const [winningTeam, setWinningTeam] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const resultId = useMemo(() => `res-${state.round}-${Math.random().toString(36).slice(2)}`, [state.round]);

  const unranked = state.order.filter((id) => !tiers.flat().includes(id));

  const rewards = state.config.rewards;

  if (state.phase === 'minigameIntro') {
    return (
      <div className="fullscreen-panel">
        <h1>Capítulo {state.round} — {def.name} {def.icon}</h1>
        <p style={{ fontSize: '1.1rem' }}>{def.description}</p>
        <div className="card-panel" style={{ maxWidth: 760 }}>
          <h3>Premiação desta prova</h3>
          <div className="reward-preview">
            {def.format === 'individual' ? (
              <>
                <span className="reward-chip">1º lugar: +{rewards.individual.first} 🪙</span>
                <span className="reward-chip">2º lugar: +{rewards.individual.second} 🪙</span>
                <span className="reward-chip">Demais: +{rewards.individual.others} 🪙</span>
              </>
            ) : (
              <>
                <span className="reward-chip">Equipe vencedora: +{rewards.teams.winner} 🪙 por pessoa</span>
                <span className="reward-chip">Equipe perdedora: +{rewards.teams.loser} 🪙 por pessoa</span>
                <span className="reward-chip">Empate: +{rewards.teams.draw} 🪙 por pessoa</span>
              </>
            )}
          </div>
          <p style={{ color: 'var(--ink-dim)', fontSize: '0.9rem' }}>
            Participar de mais partidas dentro da prova não multiplica a premiação.
            Há alternativa sem álcool para qualquer desafio.
          </p>
        </div>
        <div className="card-panel" style={{ maxWidth: 760, marginTop: '0.6rem' }}>
          <h3>Participantes</h3>
          <div className="chip-row">
            {state.order.map((id) => (
              <span key={id} className="player-chip">
                <img className="avatar" src={state.players[id].portrait} alt="" />
                {state.players[id].name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <button className="btn-primary" onClick={() => dispatch({ type: 'startMinigame' })}>
            A prova começou — registrar resultados
          </button>
        </div>
      </div>
    );
  }

  if (state.phase !== 'awaitingResults') return null;

  const teamFormat = def.format === 'teams';

  function placeAt(id: string, box: number) {
    setTiers((prev) => {
      const next = prev.map((t) => t.filter((p) => p !== id));
      while (next.length <= box) next.push([]);
      next[box] = [...next[box], id];
      return next;
    });
  }

  function removeFrom(id: string) {
    setTiers((prev) => prev.map((t) => t.filter((p) => p !== id)));
  }

  function movePlayer(id: string, teamIndex: number) {
    const next = (teams.length ? teams : autoTeams(state.order)).map((t) => t.filter((p) => p !== id));
    while (next.length <= teamIndex) next.push([]);
    next[teamIndex] = [...next[teamIndex], id];
    dispatch({ type: 'setTeams', teams: next });
  }

  const preview: Record<string, number> = {};
  if (teamFormat && winningTeam !== null) {
    teams.forEach((team, index) => {
      const prize = winningTeam < 0 ? rewards.teams.draw : index === winningTeam ? rewards.teams.winner : rewards.teams.loser;
      for (const id of team) preview[id] = prize;
    });
  }

  // Mesma normalização que o motor aplica: a prévia nunca mostra um prêmio que
  // a confirmação recusaria.
  const placement = normalizePlacement(state.order, tiers);
  if (!teamFormat && placement.ok) {
    Object.assign(preview, individualAwards(state.order, placement.tiers, rewards.individual));
  }
  const positions = boxPositions(tiers);
  const canSubmit = teamFormat ? winningTeam !== null : placement.ok;

  return (
    <div className="fullscreen-panel">
      <h1>{def.name} — resultados da rodada {state.round}</h1>

      {teamFormat ? (
        <>
          <p className="why">
            Ajuste as equipes se necessário. Com número ímpar, a primeira equipe fica com
            uma pessoa a mais — ninguém é excluído.
          </p>
          <div className="teams-grid">
            {[0, 1].map((index) => (
              <div key={index} className={`team-box ${winningTeam === index ? 'selected' : ''}`}>
                <h3>Equipe {index + 1}</h3>
                <div className="chip-row">
                  {(teams[index] ?? []).map((id) => (
                    <button
                      key={id}
                      className="player-chip"
                      onClick={() => movePlayer(id, index === 0 ? 1 : 0)}
                      title="Mover para a outra equipe"
                    >
                      <img className="avatar" src={state.players[id].portrait} alt="" />
                      {state.players[id].name}
                    </button>
                  ))}
                </div>
                <button
                  style={{ marginTop: '0.6rem' }}
                  className={winningTeam === index ? 'btn-primary' : ''}
                  onClick={() => setWinningTeam(index)}
                >
                  Equipe {index + 1} venceu
                </button>
              </div>
            ))}
          </div>
          <button className={winningTeam === -1 ? 'btn-primary' : ''} onClick={() => setWinningTeam(-1)}>
            Empate entre as equipes
          </button>
        </>
      ) : (
        <>
          <p className="why">
            Clique no gorila para colocá-lo numa posição. Empatados ficam na mesma
            posição e o próximo ocupa a posição seguinte (1º, 1º, 3º).
          </p>
          {tiers.map((tier, box) => {
            const position = positions[box];
            const locked = position === null;
            return (
              <div key={box} className="card-panel" style={{ marginBottom: '0.5rem', opacity: locked ? 0.55 : 1 }}>
                <h3>{locked ? 'Posição bloqueada' : `${position}ª posição`}</h3>
                {locked && (
                  <div style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>
                    Preencha a posição anterior antes de usar esta.
                  </div>
                )}
                <div className="chip-row">
                  {tier.map((id) => (
                    <button
                      key={id}
                      className="player-chip"
                      onClick={() => removeFrom(id)}
                      title="Remover desta posição"
                    >
                      <img className="avatar" src={state.players[id].portrait} alt="" />
                      {state.players[id].name} ✕
                    </button>
                  ))}
                </div>
                <div className="chip-row" style={{ marginTop: '0.4rem' }}>
                  {unranked.map((id) => (
                    <button
                      key={id}
                      className="player-chip dim"
                      disabled={locked}
                      onClick={() => placeAt(id, box)}
                    >
                      <img className="avatar" src={state.players[id].portrait} alt="" />
                      + {state.players[id].name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => setTiers([[], [], []])}>Limpar classificação</button>
          {!placement.ok && tiers.flat().length > 0 && (
            <div className="notice-bar error-bar" style={{ marginTop: '0.5rem' }}>
              {placement.error}
            </div>
          )}
        </>
      )}

      <div className="card-panel" style={{ marginTop: '1rem' }}>
        <h3>Prévia da premiação</h3>
        {!teamFormat && placement.ok && (
          <p style={{ margin: '0 0 0.4rem', color: 'var(--ink-dim)' }}>
            Será registrado: {describePlacement(placement.tiers, (id) => state.players[id].name)}
          </p>
        )}
        <div className="reward-preview">
          {state.order.map((id) => (
            <span key={id} className="reward-chip">
              {state.players[id].name}: +{preview[id] ?? 0} 🪙
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
        {!review ? (
          <button className="btn-primary" disabled={!canSubmit} onClick={() => setReview(true)}>
            Revisar e confirmar
          </button>
        ) : (
          <>
            <button
              className="btn-primary"
              onClick={() =>
                dispatch({
                  type: 'submitResults',
                  resultId,
                  format: teamFormat ? 'teams' : 'individual',
                  ranking: teamFormat || !placement.ok ? undefined : placement.tiers,
                  winningTeam: teamFormat ? winningTeam ?? -1 : undefined,
                })
              }
            >
              Confirmar premiação
            </button>
            <button onClick={() => setReview(false)}>Voltar e corrigir</button>
          </>
        )}
      </div>
    </div>
  );
}
