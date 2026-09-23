import { useState } from 'react';
import { Board } from '../components/Board';
import { DecisionPanel } from '../components/DecisionPanel';
import { MinigamePanel } from '../components/MinigamePanel';
import { SceneOverlay } from '../components/SceneOverlay';
import { HistoryPanel, NextMinigame, Scoreboard } from '../components/Scoreboard';
import { ITEMS } from '../data/config';
import { activePlayer, ranking, usableActiveItems } from '../game/engine';
import type { GameState } from '../game/types';
import { useGameSession, type Speed } from '../automation/useGameSession';
import type { PersistedControl } from '../persistence/storage';

interface Props {
  initialState: GameState;
  initialControl?: PersistedControl;
  onExit: () => void;
}

export function GameScreen({ initialState, initialControl, onExit }: Props) {
  const session = useGameSession({ initialState, initialControl });
  const { state } = session;
  const player = activePlayer(state);
  const [showAdjust, setShowAdjust] = useState(false);

  const canStartRound = state.phase === 'roundReady';
  const itemWindowOpen = state.phase === 'itemWindow' && state.itemWindow !== null;
  const windowItems = player ? usableActiveItems(state, player) : [];
  const pathOptions = state.pending?.kind === 'path' ? state.pending.options : [];
  const scenePortrait = session.currentScene?.playerId
    ? state.players[session.currentScene.playerId]?.portrait
    : undefined;

  return (
    <div className="app-shell">
      <div className="game-grid">
        <header className="topbar">
          <span className="brand">SUNDAY FUNDAY</span>
          <span>Rodada {state.round} / {state.config.rounds}</span>
          <span className="status" aria-live="polite">{session.status}</span>
          {session.saveError ? (
            <span className="saved error">⚠ não salvo</span>
          ) : (
            <span className="saved">✓ salvo{session.savedAt ? ` ${new Date(session.savedAt).toLocaleTimeString('pt-BR')}` : ''}</span>
          )}
          <button className="btn-ghost" onClick={onExit}>Sair</button>
        </header>

        <div className="board-pane">
          <Board
            state={state}
            highlightNodes={pathOptions}
            onNodeClick={(nodeId) => session.dispatch({ type: 'choosePath', nodeId })}
          />
          <DecisionPanel state={state} dispatch={session.dispatch} />
        </div>

        <aside className="side-pane">
          {session.tabConflict && (
            <div className="notice-bar error-bar">
              Outra aba já está com esta partida aberta. Feche a outra aba antes de continuar aqui.
              <button onClick={session.takeControl}>Assumir o controle</button>
            </div>
          )}
          {session.saveError && (
            <div className="notice-bar error-bar">
              {session.saveError}
              <button onClick={() => session.backup('emergencia')}>Exportar agora</button>
            </div>
          )}
          {state.notice && (
            <div className="notice-bar">
              {state.notice}
              <button className="btn-ghost" onClick={() => session.dispatch({ type: 'dismissNotice' })}>OK</button>
            </div>
          )}
          <Scoreboard state={state} />
          <NextMinigame state={state} />
          <div className="card-panel">
            <h3>Anfitrião</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button onClick={() => session.backup()}>Exportar backup</button>
              <button onClick={() => setShowAdjust((v) => !v)}>Correção manual</button>
              <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={session.reducedMotion} onChange={(e) => session.setReducedMotion(e.target.checked)} />
                Menos animação
              </label>
              <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={session.muted} onChange={(e) => session.setMuted(e.target.checked)} />
                Mudo
              </label>
            </div>
            {showAdjust && <ManualAdjust state={state} dispatch={session.dispatch} onDone={() => setShowAdjust(false)} />}
          </div>
          <HistoryPanel state={state} />
        </aside>

        <footer className="bottombar">
          <div className="turn-block">
            {player && <img className="avatar" src={player.portrait} alt="" style={{ borderColor: player.color }} />}
            <div>
              <div className="vez">VEZ DE</div>
              <div className="who">{player?.name ?? '—'}</div>
            </div>
          </div>

          <div className="wallet">
            <span>🪙 {player?.common ?? 0}<small>moedas</small></span>
            <span>🍌 {player?.golden ?? 0}<small>bananas de ouro</small></span>
          </div>

          <div className="inventory">
            {player?.inventory.length ? (
              player.inventory.map((item) => (
                <div key={item.uid} className="item-chip">
                  <span className="icon">{ITEMS[item.itemId].icon}</span>
                  {ITEMS[item.itemId].name}
                </div>
              ))
            ) : (
              <div className="item-chip" style={{ opacity: 0.5 }}>
                <span className="icon">—</span>sem itens
              </div>
            )}
          </div>

          <div className={`dice ${state.phase === 'readyToRoll' && !session.manualPaused ? 'rolling' : ''}`}>
            {state.dice ?? '?'}
          </div>

          {itemWindowOpen && (
            <div className="item-window">
              <div>
                <strong>Usar carta?</strong>
                <div style={{ fontSize: '0.72rem' }}>
                  {Math.ceil((session.itemRemainingMs ?? 0) / 1000)} s · {windowItems.length} item(ns)
                </div>
              </div>
              <div className="bar">
                <i style={{ width: `${((session.itemRemainingMs ?? 0) / state.config.itemWindowMs) * 100}%` }} />
              </div>
              <button className="btn-primary" onClick={() => session.dispatch({ type: 'requestItemChoice' })}>
                Usar carta
              </button>
              <button onClick={() => session.dispatch({ type: 'itemWindowExpired' })}>Seguir agora</button>
            </div>
          )}

          <div className="controls">
            {canStartRound ? (
              <button
                className="btn-primary"
                onClick={() => {
                  session.resume();
                  session.dispatch({ type: 'startRound' });
                }}
              >
                ▶ Iniciar rodada {state.round}
              </button>
            ) : (
              <button
                className={session.manualPaused ? 'btn-primary' : ''}
                onClick={session.togglePause}
                disabled={state.phase === 'finished'}
              >
                {session.manualPaused ? '▶ Retomar' : '⏸ Pausar'}
              </button>
            )}
            <SpeedControl speed={session.speed} onChange={session.setSpeed} />
            <button onClick={session.undo} disabled={!session.undoAvailable}>↺ Desfazer</button>
          </div>
        </footer>
      </div>

      {(state.phase === 'minigameIntro' || state.phase === 'awaitingResults') && (
        <MinigamePanel state={state} dispatch={session.dispatch} />
      )}

      {state.phase === 'roundEnd' && (
        <div className="fullscreen-panel">
          <h1>Rodada {state.round} concluída</h1>
          {state.results.filter((r) => r.round === state.round).map((result, i) => (
            <div key={i} className="card-panel" style={{ maxWidth: 820 }}>
              <h3>Resultado</h3>
              <p>{result.detail}</p>
              <div className="reward-preview">
                {Object.entries(result.awards).map(([id, amount]) => (
                  <span key={id} className="reward-chip">{state.players[id].name}: +{amount} 🪙</span>
                ))}
              </div>
            </div>
          ))}
          <div className="card-panel" style={{ maxWidth: 820, marginTop: '0.6rem' }}>
            <h3>Classificação atual</h3>
            <div className="reward-preview">
              {ranking(state).map((p, i) => (
                <span key={p.id} className="reward-chip">{i + 1}º {p.name} — 🍌 {p.golden} · 🪙 {p.common}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '0.6rem' }}>
            <button className="btn-primary" onClick={() => session.dispatch({ type: 'nextRound' })}>
              {state.round >= state.config.rounds ? 'Ir para a apuração final' : `Iniciar próxima rodada (${state.round + 1})`}
            </button>
            <button onClick={() => session.backup(`rodada-${state.round}`)}>Exportar backup</button>
          </div>
        </div>
      )}

      {state.phase === 'finished' && <FinalPanel state={state} onExit={onExit} onBackup={() => session.backup('final')} />}

      <SceneOverlay
        scene={session.currentScene}
        portrait={scenePortrait}
        reducedMotion={session.reducedMotion}
        muted={session.muted}
        onSkip={session.skipScene}
      />
    </div>
  );
}

function SpeedControl({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  return (
    <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
      Velocidade
      <select value={speed} onChange={(e) => onChange(e.target.value as Speed)} aria-label="Velocidade da automação">
        <option value="normal">Normal</option>
        <option value="fast">Rápida</option>
      </select>
    </label>
  );
}

function ManualAdjust({
  state,
  dispatch,
  onDone,
}: {
  state: GameState;
  dispatch: ReturnType<typeof useGameSession>['dispatch'];
  onDone: () => void;
}) {
  const [playerId, setPlayerId] = useState(state.order[0]);
  const target = state.players[playerId];
  const [common, setCommon] = useState(target.common);
  const [golden, setGolden] = useState(target.golden);
  const [reason, setReason] = useState('');

  return (
    <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.4rem' }}>
      <select
        value={playerId}
        aria-label="Jogador a corrigir"
        onChange={(e) => {
          setPlayerId(e.target.value);
          setCommon(state.players[e.target.value].common);
          setGolden(state.players[e.target.value].golden);
        }}
      >
        {state.order.map((id) => <option key={id} value={id}>{state.players[id].name}</option>)}
      </select>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input type="number" min={0} value={common} aria-label="Moedas" onChange={(e) => setCommon(Number(e.target.value))} />
        <input type="number" min={0} value={golden} aria-label="Bananas douradas" onChange={(e) => setGolden(Number(e.target.value))} />
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--ink-dim)' }}>
        Antes: 🪙 {target.common} · 🍌 {target.golden} → Depois: 🪙 {common} · 🍌 {golden}
      </div>
      <input placeholder="Motivo (obrigatório)" value={reason} aria-label="Motivo" onChange={(e) => setReason(e.target.value)} />
      <button
        disabled={!reason.trim()}
        onClick={() => {
          if (dispatch({ type: 'manualAdjust', playerId, common, golden, reason })) onDone();
        }}
      >
        Aplicar correção
      </button>
    </div>
  );
}

function FinalPanel({ state, onExit, onBackup }: { state: GameState; onExit: () => void; onBackup: () => void }) {
  const sorted = ranking(state);
  const podium = sorted.slice(0, 3);
  const heights = [170, 130, 105];
  const tieTop = sorted.length > 1 &&
    sorted[0].golden === sorted[1].golden && sorted[0].common === sorted[1].common;

  return (
    <div className="fullscreen-panel">
      <h1>🏆 Campeão do Sunday Funday</h1>
      <div className="podium">
        {[1, 0, 2].map((index) => {
          const p = podium[index];
          if (!p) return null;
          return (
            <div className="step" key={p.id}>
              <img className="avatar" src={p.portrait} alt="" style={{ borderColor: p.color }} />
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>🍌 {p.golden} · 🪙 {p.common}</div>
              <div className="block" style={{ height: heights[index] }}>{index + 1}º</div>
            </div>
          );
        })}
      </div>

      {tieTop && (
        <div className="notice-bar">
          Empate absoluto na liderança. Faça uma prova de desempate presencial e registre o
          vencedor com a correção manual antes de anunciar o prêmio.
        </div>
      )}

      <div className="card-panel" style={{ maxWidth: 900 }}>
        <h3>Classificação final (douradas primeiro, depois moedas)</h3>
        <div className="reward-preview">
          {sorted.map((p, i) => (
            <span key={p.id} className="reward-chip">{i + 1}º {p.name} — 🍌 {p.golden} · 🪙 {p.common}</span>
          ))}
        </div>
      </div>

      <div className="card-panel" style={{ maxWidth: 900, marginTop: '0.6rem' }}>
        <h3>Provas da festa</h3>
        <div className="reward-preview">
          {state.results.map((r, i) => (
            <span key={i} className="reward-chip">R{r.round} · {r.minigameId}: {r.detail}</span>
          ))}
        </div>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
        Prêmio físico: o gorilão corpulento rebolando. 🦍
      </p>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '0.6rem' }}>
        <button className="btn-primary" onClick={onBackup}>Exportar estado final</button>
        <button onClick={onExit}>Voltar ao início</button>
      </div>
    </div>
  );
}
