import { useEffect, useMemo, useState } from 'react';
import { MINIGAMES } from '../data/config';
import { autoTeams, minigameForRound } from '../game/engine';
import { minigameRuleForState, previewModernMinigameResult, usesModernMinigameRules } from '../game/minigameRules';
import { boxPositions, describePlacement, individualAwards, normalizePlacement } from '../game/placements';
import type { Command, GameState } from '../game/types';

interface Props { state: GameState; dispatch: (command: Command) => boolean }

const name = (state: GameState, id: string) => state.players[id]?.name ?? id;

function Chip({ state, id, selected, onClick, disabled }: { state: GameState; id: string; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  const player = state.players[id];
  return <button type="button" className={`player-chip ${selected ? 'selected' : ''}`} aria-pressed={selected} disabled={disabled} onClick={onClick}><img className="avatar" src={player.portrait} alt="" />{player.name}{selected ? ' ✓' : ''}</button>;
}

function Preview({ state, awards, goldenAwards = {} }: { state: GameState; awards: Record<string, number>; goldenAwards?: Record<string, number> }) {
  return <div className="reward-preview" aria-label="Prévia da premiação">{state.order.map((id) => <span key={id} className="reward-chip">{name(state, id)}: +{awards[id] ?? 0} 🪙{goldenAwards[id] ? ` · +${goldenAwards[id]} 🍌` : ''}</span>)}</div>;
}

function ModernPanel({ state, dispatch }: Props) {
  const game = minigameForRound(state, state.round);
  const rule = minigameRuleForState(state);
  if (!rule) return <LegacyPanel state={state} dispatch={dispatch} />;
  const excludedIds = state.minigame?.excludedPlayerIds ?? [];
  const eligibleIds = state.order.filter((id) => !excludedIds.includes(id));
  const roundKey = `${state.gameId}:${state.round}:${game.id}`;
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const resultId = useMemo(() => `res-${roundKey}-${crypto.randomUUID()}`, [roundKey]);
  useEffect(() => { setWinnerIds([]); setReview(false); setSubmitError(null); }, [roundKey]);
  const preview = previewModernMinigameResult(state, winnerIds);
  const limit = rule.resultMode === 'duo' ? 2 : rule.resultMode === 'single' ? 1 : undefined;
  const instruction = rule.resultMode === 'duo' ? 'Selecione 1 vencedor solo quando houver número ímpar de participantes, ou 2 vencedores da dupla.' : rule.resultMode === 'group' ? 'Selecione todas as pessoas do grupo vencedor.' : 'Selecione exatamente 1 vencedor.';
  const toggle = (id: string) => { setReview(false); setSubmitError(null); setWinnerIds((current) => current.includes(id) ? current.filter((x) => x !== id) : limit && current.length >= limit ? current : [...current, id]); };
  const confirm = () => {
    const accepted = dispatch({ type: 'submitResults', resultId, format: game.format, winnerIds });
    if (!accepted) setSubmitError('O resultado não foi registrado. Revise a seleção e tente novamente.');
  };

  if (state.phase === 'minigameIntro') return <div className="fullscreen-panel">
    <h1>Capítulo {state.round} — {game.name} {game.icon}</h1><p style={{ fontSize: '1.1rem' }}>{game.description}</p>
    <div className="card-panel" style={{ maxWidth: 760 }}><h3>Regras e prêmio</h3><p className="why">{instruction}</p><div className="reward-preview"><span className="reward-chip">Vencedor(es): +{rule.winnerCoins ?? 0} 🪙 cada</span>{(rule.otherCoins ?? 0) > 0 && <span className="reward-chip">Demais: +{rule.otherCoins} 🪙 cada</span>}{(rule.excludedCoins ?? 0) > 0 && <span className="reward-chip">Fora: +{rule.excludedCoins} 🪙 cada</span>}{(rule.winnerGolden ?? 0) > 0 && <span className="reward-chip">Vencedor: +{rule.winnerGolden} 🍌</span>}</div><p className="why">{rule.resultMode === 'single' ? 'Disputa individual. Resolva qualquer empate antes de registrar o vencedor.' : 'As equipes e duplas são sorteadas fora do app. Aqui só registramos o resultado.'}</p></div>
    <div className="card-panel" style={{ maxWidth: 760, marginTop: '0.6rem' }}><h3>Participantes</h3><div className="chip-row">{eligibleIds.map((id) => <span key={id} className="player-chip"><img className="avatar" src={state.players[id].portrait} alt="" />{name(state, id)}</span>)}</div>{excludedIds.length > 0 && <><h3 style={{ marginTop: '1rem' }}>Fora desta prova</h3><p className="why">Sorteados pelo sistema para ficar fora desta prova; recebem a compensação ao confirmar o resultado.</p><div className="chip-row">{excludedIds.map((id) => <span key={id} className="player-chip dim"><img className="avatar" src={state.players[id].portrait} alt="" />{name(state, id)}</span>)}</div></>}</div>
    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}><button className="btn-primary" onClick={() => dispatch({ type: 'startMinigame' })}>A prova começou — registrar resultado</button></div>
  </div>;
  if (state.phase !== 'awaitingResults') return null;
  return <div className="fullscreen-panel"><h1>{game.name} — resultado da rodada {state.round}</h1><p className="why">{instruction}</p>{excludedIds.length > 0 && <p className="notice-bar">Fora da prova (+{rule.excludedCoins ?? 0} 🪙): {excludedIds.map((id) => name(state, id)).join(', ')}.</p>}<div className="card-panel"><h3>{rule.resultMode === 'group' ? 'Grupo vencedor' : 'Vencedor(es)'}</h3><div className="chip-row">{eligibleIds.map((id) => <Chip key={id} state={state} id={id} selected={winnerIds.includes(id)} onClick={() => toggle(id)} />)}</div>{limit && winnerIds.length >= limit && <p className="why">Limite de {limit} selecionado(s).</p>}</div><div className="card-panel" style={{ marginTop: '1rem' }}><h3>Prévia exata da premiação</h3>{preview.ok ? <Preview state={state} awards={preview.awards} goldenAwards={preview.goldenAwards} /> : <p className="why">{preview.error}</p>}</div>{submitError && <div className="notice-bar error-bar" role="alert">{submitError}</div>}<div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>{!review ? <button className="btn-primary" disabled={!preview.ok} onClick={() => setReview(true)}>Revisar e confirmar</button> : <><button className="btn-primary" onClick={confirm}>Confirmar premiação</button><button onClick={() => setReview(false)}>Voltar e corrigir</button></>}</div></div>;
}

/** Mantém a experiência de ranking/equipes das partidas e saves anteriores. */
function LegacyPanel({ state, dispatch }: Props) {
  const game = minigameForRound(state, state.round);
  const def = MINIGAMES.find((m) => m.id === (state.minigame?.minigameId ?? game.id)) ?? game;
  const teams = state.minigame?.teams ?? [];
  const key = `${state.round}:${def.id}`;
  const [tiers, setTiers] = useState<string[][]>([[], [], []]); const [winningTeam, setWinningTeam] = useState<number | null>(null); const [review, setReview] = useState(false); const resultId = useMemo(() => `res-${key}-${crypto.randomUUID()}`, [key]);
  useEffect(() => { setTiers([[], [], []]); setWinningTeam(null); setReview(false); }, [key]);
  const rewards = state.config.rewards;
  if (state.phase === 'minigameIntro') return <div className="fullscreen-panel"><h1>Capítulo {state.round} — {def.name} {def.icon}</h1><p style={{ fontSize: '1.1rem' }}>{def.description}</p><div className="card-panel"><h3>Premiação desta prova</h3><div className="reward-preview">{def.format === 'individual' ? <><span className="reward-chip">1º: +{rewards.individual.first} 🪙</span><span className="reward-chip">2º: +{rewards.individual.second} 🪙</span></> : <><span className="reward-chip">Equipe vencedora: +{rewards.teams.winner} 🪙</span><span className="reward-chip">Empate: +{rewards.teams.draw} 🪙</span></>}</div></div><div style={{ marginTop: 'auto', paddingTop: '1rem' }}><button className="btn-primary" onClick={() => dispatch({ type: 'startMinigame' })}>A prova começou — registrar resultados</button></div></div>;
  if (state.phase !== 'awaitingResults') return null;
  const isTeams = def.format === 'teams'; const placement = normalizePlacement(state.order, tiers); const preview: Record<string, number> = {};
  if (isTeams && winningTeam !== null) teams.forEach((team, index) => team.forEach((id) => { preview[id] = winningTeam < 0 ? rewards.teams.draw : index === winningTeam ? rewards.teams.winner : rewards.teams.loser; }));
  if (!isTeams && placement.ok) Object.assign(preview, individualAwards(state.order, placement.tiers, rewards.individual));
  const unranked = state.order.filter((id) => !tiers.flat().includes(id)); const positions = boxPositions(tiers);
  const move = (id: string, to: number) => { const next = (teams.length ? teams : autoTeams(state.order)).map((team) => team.filter((x) => x !== id)); next[to].push(id); dispatch({ type: 'setTeams', teams: next }); };
  return <div className="fullscreen-panel"><h1>{def.name} — resultados da rodada {state.round}</h1>{isTeams ? <><div className="teams-grid">{[0, 1].map((index) => <div key={index} className={`team-box ${winningTeam === index ? 'selected' : ''}`}><h3>Equipe {index + 1}</h3><div className="chip-row">{(teams[index] ?? []).map((id) => <Chip key={id} state={state} id={id} onClick={() => move(id, index === 0 ? 1 : 0)} />)}</div><button className={winningTeam === index ? 'btn-primary' : ''} onClick={() => setWinningTeam(index)}>Equipe {index + 1} venceu</button></div>)}</div><button className={winningTeam === -1 ? 'btn-primary' : ''} onClick={() => setWinningTeam(-1)}>Empate</button></> : <>{tiers.map((tier, box) => <div key={box} className="card-panel" style={{ opacity: positions[box] === null ? 0.55 : 1 }}><h3>{positions[box] === null ? 'Posição bloqueada' : `${positions[box]}ª posição`}</h3><div className="chip-row">{tier.map((id) => <Chip key={id} state={state} id={id} onClick={() => setTiers((old) => old.map((row) => row.filter((x) => x !== id)))} />)}</div><div className="chip-row">{unranked.map((id) => <Chip key={id} state={state} id={id} disabled={positions[box] === null} onClick={() => setTiers((old) => old.map((row, index) => index === box ? [...row, id] : row.filter((x) => x !== id)))} />)}</div></div>)}{!placement.ok && tiers.flat().length > 0 && <div className="notice-bar error-bar">{placement.error}</div>}</>}<div className="card-panel" style={{ marginTop: '1rem' }}><h3>Prévia da premiação</h3>{!isTeams && placement.ok && <p className="why">{describePlacement(placement.tiers, (id) => name(state, id))}</p>}<Preview state={state} awards={preview} /></div><div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>{!review ? <button className="btn-primary" disabled={isTeams ? winningTeam === null : !placement.ok} onClick={() => setReview(true)}>Revisar e confirmar</button> : <><button className="btn-primary" onClick={() => dispatch({ type: 'submitResults', resultId, format: isTeams ? 'teams' : 'individual', ranking: isTeams || !placement.ok ? undefined : placement.tiers, winningTeam: isTeams ? winningTeam ?? -1 : undefined })}>Confirmar premiação</button><button onClick={() => setReview(false)}>Voltar e corrigir</button></>}</div></div>;
}

export function MinigamePanel({ state, dispatch }: Props) { return usesModernMinigameRules(state) ? <ModernPanel state={state} dispatch={dispatch} /> : <LegacyPanel state={state} dispatch={dispatch} />; }
