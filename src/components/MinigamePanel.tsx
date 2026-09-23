import { useMemo, useState } from 'react';
import { MINIGAMES } from '../data/config';
import { autoTeams, minigameForRound } from '../game/engine';
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
  const [ranking, setRanking] = useState<string[][]>([]);
  const [winningTeam, setWinningTeam] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  const resultId = useMemo(() => `res-${state.round}-${Math.random().toString(36).slice(2)}`, [state.round]);

  const unranked = state.order.filter((id) => !ranking.flat().includes(id));

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

  function toggleRank(id: string, tier: number) {
    setRanking((prev) => {
      const next = prev.map((t) => t.filter((p) => p !== id));
      while (next.length <= tier) next.push([]);
      next[tier] = [...next[tier], id];
      return next.filter((t, i) => t.length > 0 || i < tier);
    });
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
  } else if (!teamFormat) {
    let position = 1;
    for (const tier of ranking) {
      const prize = position === 1 ? rewards.individual.first : position === 2 ? rewards.individual.second : rewards.individual.others;
      for (const id of tier) preview[id] = prize;
      position += tier.length;
    }
    for (const id of unranked) preview[id] = rewards.individual.others;
  }

  const canSubmit = teamFormat ? winningTeam !== null : ranking.flat().length > 0;

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
          {[0, 1, 2].map((tier) => (
            <div key={tier} className="card-panel" style={{ marginBottom: '0.5rem' }}>
              <h3>{tier + 1}ª posição</h3>
              <div className="chip-row">
                {(ranking[tier] ?? []).map((id) => (
                  <span key={id} className="player-chip">
                    <img className="avatar" src={state.players[id].portrait} alt="" />
                    {state.players[id].name}
                  </span>
                ))}
              </div>
              <div className="chip-row" style={{ marginTop: '0.4rem' }}>
                {unranked.map((id) => (
                  <button key={id} className="player-chip dim" onClick={() => toggleRank(id, tier)}>
                    <img className="avatar" src={state.players[id].portrait} alt="" />
                    + {state.players[id].name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setRanking([])}>Limpar classificação</button>
        </>
      )}

      <div className="card-panel" style={{ marginTop: '1rem' }}>
        <h3>Prévia da premiação</h3>
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
                  ranking: teamFormat ? undefined : ranking,
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
