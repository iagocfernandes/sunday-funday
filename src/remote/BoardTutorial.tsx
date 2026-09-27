import { GameIcon } from '../components/GameIcon';
import { MINIGAMES } from '../data/config';
import { START_PASS_BONUS } from '../game/boardRules';
import type { GameState } from '../game/types';
import { BOARD_TUTORIAL_CARD_COUNT, type BoardTutorial as TutorialState, type RemoteCommand } from './types';
import './board-tutorial.css';

type Act = (command: RemoteCommand) => Promise<boolean>;

export function BoardTutorial({ state, tutorial, matchId, busy, act }: {
  state: GameState;
  tutorial: TutorialState;
  matchId: string;
  busy: boolean;
  act: Act;
}) {
  const finalId = state.config.minigameOrder.at(-1);
  const finalGolden = MINIGAMES.find(game => game.id === finalId)?.winnerGolden;
  const cards = [
    {
      eyebrow: 'COMO VENCER',
      title: 'Bananas primeiro. Moedas no desempate.',
      body: <><p>Compre cada <GameIcon kind="banana"/> banana dourada por <b>{state.config.goldenPrice} moedas</b>. Quem tiver mais bananas vence; moedas decidem o empate.</p><p>Você começa com <b>{state.config.startingCommon} moedas</b> e ganha <b>+{START_PASS_BONUS}</b> ao passar pelo Início.</p></>,
      icon: '🍌',
    },
    {
      eyebrow: 'SEU TURNO',
      title: 'Poder, dado e escolhas no celular.',
      body: <><p>Antes do dado, use até <b>{state.config.activeItemsPerTurn} poder</b>. Sua mão comporta no máximo <b>{state.config.inventoryLimit}</b>.</p><p>Caminho, alvo, compra e outras decisões aparecem no celular do jogador responsável.</p></>,
      icon: '📱',
    },
    {
      eyebrow: 'PELO CAMINHO',
      title: 'Cada parada muda a jogada.',
      body: <ul><li><b>+ / −:</b> ganhe {state.config.plusAmount} ou perca até {state.config.minusAmount} moedas. Sorte e Azar revelam um evento.</li><li><b>Loja:</b> compre poderes pelo celular.</li><li><b>Iagugu:</b> escolha uma vítima e o que roubar.</li><li><b>Duelo:</b> Beer Pong, 3 copos de cada lado; o anfitrião registra quem venceu.</li></ul>,
      icon: '🗺️',
    },
    {
      eyebrow: 'FIM DE CADA RODADA',
      title: 'Prova presencial, resultado na TV.',
      body: <><p>Há uma prova ao fim de cada uma das <b>{state.config.rounds} rodadas</b>. O anfitrião escolhe os vencedores e confirma o resultado.</p>{finalGolden ? <p>A prova final vale <b>{finalGolden} <GameIcon kind="banana"/> banana dourada</b> para quem vencer.</p> : <p>A premiação final segue as regras desta partida.</p>}</>,
      icon: '🏆',
    },
  ];
  const step = Math.min(Math.max(0, tutorial.step), BOARD_TUTORIAL_CARD_COUNT - 1);
  const card = cards[step];
  const command = (action: 'next' | 'back' | 'skip') => void act({ type: 'tutorial', matchId, action });

  return <section className="board-tutorial" role="dialog" aria-modal="true" aria-label="Como jogar">
    <article className="board-tutorial__card" key={step}>
      <div className="board-tutorial__progress" aria-label={`Passo ${step + 1} de ${BOARD_TUTORIAL_CARD_COUNT}`}>
        {cards.map((_, index) => <span key={index} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}/>) }
      </div>
      <div className="board-tutorial__icon" aria-hidden="true">{card.icon}</div>
      <small>{card.eyebrow} · {step + 1}/{BOARD_TUTORIAL_CARD_COUNT}</small>
      <h1>{card.title}</h1>
      <div className="board-tutorial__body">{card.body}</div>
      <div className="board-tutorial__actions">
        <button onClick={() => command('back')} disabled={busy || step === 0}>← Voltar</button>
        <button className="board-tutorial__primary" onClick={() => command('next')} disabled={busy}>{busy ? 'Salvando…' : step === cards.length - 1 ? 'Começar partida' : 'Próximo →'}</button>
      </div>
      <button className="board-tutorial__skip" onClick={() => command('skip')} disabled={busy}>Pular tutorial</button>
    </article>
  </section>;
}
