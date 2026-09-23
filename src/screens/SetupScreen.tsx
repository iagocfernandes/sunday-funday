import { useMemo, useState } from 'react';
import {
  DEFAULT_COLORS, DEFAULT_CONFIG, DEFAULT_SYMBOLS, DEMO_NAMES,
  MINIGAMES, PORTRAITS, defaultMinigameOrder,
} from '../data/config';
import { createDefaultMap, validateMap } from '../data/map';
import { createGame, type PlayerSeed } from '../game/engine';
import { newSeed } from '../game/rng';
import type { GameConfig, GameState } from '../game/types';

interface Props {
  demo: boolean;
  onStart: (state: GameState) => void;
  onCancel: () => void;
}

function seedFor(index: number, name: string): PlayerSeed {
  return {
    id: `p${index}`,
    name,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    symbol: DEFAULT_SYMBOLS[index % DEFAULT_SYMBOLS.length],
    portrait: PORTRAITS[index % PORTRAITS.length],
  };
}

export function SetupScreen({ demo, onStart, onCancel }: Props) {
  const [names, setNames] = useState<string[]>(() =>
    demo ? DEMO_NAMES.slice(0, 8) : ['', '', '', '', '', '', '', ''],
  );
  const [rounds, setRounds] = useState(demo ? 2 : DEFAULT_CONFIG.rounds);
  const [goldenPrice, setGoldenPrice] = useState(DEFAULT_CONFIG.goldenPrice);
  const [startingCommon, setStartingCommon] = useState(DEFAULT_CONFIG.startingCommon);
  const [diceMax, setDiceMax] = useState(DEFAULT_CONFIG.diceMax);
  const [thiefEnabled, setThiefEnabled] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState(true);
  const [order, setOrder] = useState<string[]>([]);

  const map = useMemo(() => createDefaultMap(), []);
  // Semente fixa: a ordem sorteada na prévia é a mesma da partida iniciada.
  const [seed, setSeed] = useState(() => newSeed());
  const validation = useMemo(() => validateMap(map), [map]);

  const filled = names.map((n) => n.trim()).filter(Boolean);
  const duplicated = new Set(filled).size !== filled.length;
  const canStart = filled.length >= 2 && !duplicated && validation.ok;

  const seeds = filled.map((name, index) => seedFor(index, name));

  function buildConfig(): Partial<GameConfig> {
    return {
      rounds,
      goldenPrice,
      startingCommon,
      diceMax,
      thiefEnabled,
      minigameOrder: defaultMinigameOrder(rounds),
    };
  }

  function draw() {
    const next = newSeed();
    setSeed(next);
    const state = createGame(seeds, buildConfig(), { map, shuffleOrder, seed: next });
    setOrder(state.order.map((id) => state.players[id].name));
  }

  return (
    <div className="setup">
      <h1 style={{ color: 'var(--gold)' }}>Preparação da partida{demo ? ' (demonstração)' : ''}</h1>
      <p className="why" style={{ color: 'var(--ink-dim)' }}>
        Todos os valores abaixo são propostas de teste e podem ser alterados antes de começar.
        A janela de 5 s para itens ativos é regra confirmada e não é editável.
      </p>

      <h2>Gorilas ({filled.length})</h2>
      <div className="setup-grid">
        {names.map((name, index) => (
          <div className="player-row" key={index}>
            <img className="avatar" src={PORTRAITS[index % PORTRAITS.length]} alt="" style={{ borderColor: DEFAULT_COLORS[index % DEFAULT_COLORS.length] }} />
            <input
              value={name}
              placeholder={`Gorila ${index + 1}`}
              aria-label={`Nome do jogador ${index + 1}`}
              onChange={(e) => setNames((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
            />
            <span style={{ color: DEFAULT_COLORS[index % DEFAULT_COLORS.length], fontSize: '1.4rem', textAlign: 'center' }}>
              {DEFAULT_SYMBOLS[index % DEFAULT_SYMBOLS.length]}
            </span>
            <button
              className="btn-ghost"
              aria-label={`Remover jogador ${index + 1}`}
              onClick={() => setNames((prev) => prev.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
        <button disabled={names.length >= 10} onClick={() => setNames((prev) => [...prev, ''])}>
          + Adicionar gorila
        </button>
        <button onClick={() => setNames(DEMO_NAMES.slice(0, Math.max(8, names.length)))}>
          Preencher com nomes fictícios
        </button>
      </div>
      {duplicated && <p style={{ color: 'var(--red)' }}>Há nomes repetidos.</p>}

      <h2 style={{ marginTop: '1.4rem' }}>Configuração (propostas)</h2>
      <div className="field-row">
        <div className="field">
          <label htmlFor="rounds">Rodadas</label>
          <input id="rounds" type="number" min={1} max={20} value={rounds}
            onChange={(e) => setRounds(Math.max(1, Number(e.target.value)))} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label htmlFor="dice">Dado máximo</label>
          <input id="dice" type="number" min={2} max={20} value={diceMax}
            onChange={(e) => setDiceMax(Math.max(2, Number(e.target.value)))} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label htmlFor="start">Saldo inicial</label>
          <input id="start" type="number" min={0} value={startingCommon}
            onChange={(e) => setStartingCommon(Math.max(0, Number(e.target.value)))} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label htmlFor="golden">Preço da dourada</label>
          <input id="golden" type="number" min={1} value={goldenPrice}
            onChange={(e) => setGoldenPrice(Math.max(1, Number(e.target.value)))} style={{ width: 110 }} />
        </div>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={thiefEnabled} onChange={(e) => setThiefEnabled(e.target.checked)} />
          Ativar ladrão (desligado por padrão)
        </label>
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="checkbox" checked={shuffleOrder} onChange={(e) => setShuffleOrder(e.target.checked)} />
          Sortear a ordem
        </label>
      </div>

      <h2>Sequência de provas</h2>
      <div className="chip-row">
        {defaultMinigameOrder(rounds).map((id, index) => {
          const game = MINIGAMES.find((m) => m.id === id)!;
          return (
            <span key={index} className="reward-chip">
              R{index + 1}: {game.icon} {game.name}
            </span>
          );
        })}
      </div>

      <h2 style={{ marginTop: '1.2rem' }}>Resumo das regras</h2>
      <ul style={{ color: 'var(--ink-dim)', lineHeight: 1.7 }}>
        <li>Um clique em <strong>Iniciar rodada</strong> conduz todos os turnos automaticamente.</li>
        <li>Quem tem item ativo tem 5 s para usá-lo; quem não tem, não espera.</li>
        <li>Decisões (bifurcação, compra, alvo, defesa, carta física) não expiram.</li>
        <li>Após todos os turnos acontece exatamente um minigame presencial.</li>
        <li>Classificação: bananas douradas primeiro, depois moedas.</li>
        <li>Mapa: {Object.keys(map.nodes).length} casas, duas bifurcações. {validation.ok ? 'Grafo validado ✓' : 'GRAFO INVÁLIDO'}</li>
      </ul>
      {!validation.ok && (
        <div className="notice-bar error-bar">{validation.errors.join(' | ')}</div>
      )}

      <div className="field-row">
        <button onClick={draw} disabled={!canStart}>Sortear ordem</button>
        {order.length > 0 && <span>Ordem: {order.join(' → ')}</span>}
      </div>

      <div className="field-row">
        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={() => onStart(createGame(seeds, buildConfig(), { map, shuffleOrder, seed }))}
        >
          Começar jogo
        </button>
        <button onClick={onCancel}>Voltar</button>
        <span style={{ color: 'var(--ink-dim)' }}>
          Confirme volume, tela cheia (F11) e legibilidade na TV antes de começar.
        </span>
      </div>
    </div>
  );
}
