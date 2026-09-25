import { useEffect, useMemo, useRef, useState } from 'react';
import { CARDS_BY_ID } from '../data/cards';
import { ITEMS } from '../data/config';
import type { DomainEvent, GameState } from '../game/types';
import type { BoardView, RemoteEvent } from '../remote/types';

export type MiguelMood = 'neutral' | 'happy' | 'mischievous' | 'sad';

export interface MiguelHostBoard {
  matchId: BoardView['matchId'];
  events: readonly RemoteEvent[];
}

export interface MiguelHostMessage {
  text: string;
  mood: MiguelMood;
  key: string;
  source?: 'ma02';
}

export interface MiguelHostReaction {
  messageId: string | null;
  text: string | null;
  visible: boolean;
  mood: MiguelMood;
  dismiss: () => void;
}

export interface MiguelHostResult extends MiguelHostReaction {
  message: MiguelHostMessage | null;
}

const DISPLAY_MS = 5000;

function playerName(state: GameState, id: string) {
  return state.players[id]?.name ?? 'alguém';
}

function eventPriority(event: DomainEvent) {
  switch (event.type) {
    case 'gameCompleted': return 100;
    case 'minigameCompleted': return 90;
    case 'goldenBananaPurchased': return 85;
    case 'cardResolved': return 80;
    case 'attackResolved': case 'attackBlocked': case 'attackReversed': return 75;
    case 'itemUsed': case 'itemGranted': return 70;
    case 'minigameStarted': return 60;
    case 'roundEnded': case 'roundStarted': return 50;
    case 'turnStarted': return 20;
    case 'coinsChanged': return 10;
    case 'diceRolled': return 40;
    default: return 10;
  }
}

/** First connection consumes the server history without replaying it. */
export function freshMiguelEvents(
  events: readonly RemoteEvent[],
  matchId: string,
  cursor: number | null,
): { fresh: RemoteEvent[]; cursor: number } {
  const matching = events.filter(event => event.matchId === matchId);
  const latest = matching.reduce((max, event) => Math.max(max, event.seq), 0);
  if (cursor === null) return { fresh: [], cursor: latest };
  const freshBySeq = new Map<number, RemoteEvent>();
  for (const event of matching) {
    if (event.seq > cursor && !freshBySeq.has(event.seq)) freshBySeq.set(event.seq, event);
  }
  const fresh = [...freshBySeq.values()].sort((a, b) => a.seq - b.seq);
  return { fresh, cursor: Math.max(cursor, latest) };
}

export function persistentMiguelSad(state: GameState) {
  return Object.values(state.players).some(player =>
    player.tasks?.some(task => task.cardId === 'MA02' && task.untilRound > state.round),
  );
}

function soberUntilRound(state: GameState, playerId: string) {
  const task = state.players[playerId]?.tasks?.find(item => item.cardId === 'MA02');
  if (task) return task.untilRound;
  return state.round + (state.players[playerId]?.name.trim().toUpperCase() === 'AR2' ? 2 : 1);
}

function cardText(cardId: string, state: GameState, playerId: string) {
  const name = playerName(state, playerId);
  switch (cardId) {
    case 'MA02': return { mood: 'sad' as const, text: `Água até a rodada ${soberUntilRound(state, playerId)}. AR2 ficou triste.`, source: 'ma02' as const };
    case 'MA03': return { mood: 'mischievous' as const, text: 'Cinco pra trás! Esse GPS foi comprado na promoção?' };
    case 'MA04': return { mood: 'mischievous' as const, text: `Chef ${name}, a ilha pediu o ponto da carne.` };
    case 'MA05': return { mood: 'mischievous' as const, text: 'Bill e Maya estão esperando a escolta VIP.' };
    case 'MA07': return { mood: 'mischievous' as const, text: 'A banana foi de arrasta. Eu não vi nada.' };
    case 'MA01': return { mood: 'mischievous' as const, text: `${name} encarou o shot de bananinha. Coragem questionável.` };
    case 'MA06': return { mood: 'mischievous' as const, text: `${name} entrou para a Bunda da Fama. A câmera não esquece.` };
    case 'A01': return { mood: 'mischievous' as const, text: `${name} pisou na casca. A gravidade fez seu trabalho.` };
    case 'A02': return { mood: 'mischievous' as const, text: `${name} voltou três casas. O GPS pediu desculpas.` };
    case 'MS01': return { mood: 'happy' as const, text: `${name} está de olho numa banana dourada.` };
    case 'MS02': return { mood: 'happy' as const, text: `Cinco casas pra frente para ${name}. A ilha piscou.` };
    case 'MS03': return { mood: 'mischievous' as const, text: `${name} está de olho no poder alheio.` };
    case 'MS04': return { mood: 'happy' as const, text: `Loteria gorila para ${name}: metade das moedas no alvo.` };
    case 'MS05': return { mood: 'happy' as const, text: `Atalho dourado para ${name}.` };
    case 'MS06': return { mood: 'mischievous' as const, text: `Duelo à vista para ${name}. Chamem as bananas.` };
    default: return null;
  }
}

function itemText(itemId: keyof typeof ITEMS, state: GameState, playerId: string, used: boolean) {
  const name = playerName(state, playerId);
  if (itemId === 'preguicao' && !used) return 'Comprou Preguição? Os amigos que lutem.';
  if (itemId === 'preguicao' && used) return `${name} apertou o freio de alguém com a Preguição.`;
  if (itemId === 'blindado' && used) return `${name} ativou o Blindado. Ataque bateu no capacete.`;
  if (itemId === 'dadoDuplo' && used) return `${name} chamou dois dados para a reunião.`;
  if (itemId === 'dadoCerteiro' && used) return `${name} apontou o Dado Certeiro para o destino.`;
  if (itemId === 'trocaTroca' && used) return `${name} embaralhou as posições. Ninguém respira.`;
  if (itemId === 'mudaBanana' && used) return `${name} mudou a banana para outra árvore do Fábio.`;
  if (itemId === 'bananaTurbo' && used) return `${name} ligou o Turbo. Segurem as folhas.`;
  if (itemId === 'maoNoBolso' && used) return `${name} meteu a Mão no Bolso alheio.`;
  if (itemId === 'casca' && used) return `${name} soltou uma casca. Olhem por onde andam.`;
  if (itemId === 'reverse' && used) return `${name} devolveu o ataque com recibo.`;
  const item = ITEMS[itemId];
  return used
    ? `${item.name} ativado. A ilha ficou esperta.`
    : `${name} ganhou ${item.name}. Guardem bem esse truque.`;
}

export function messageForMiguelCardPreview(state: GameState, occurrenceKey?: string): MiguelHostMessage | null {
  const pending = state.pending;
  if (!pending || pending.kind !== 'cardPreview') return null;
  const card = CARDS_BY_ID[pending.cardId];
  if (!card) return null;
  const special = cardText(pending.cardId, state, pending.playerId);
  return {
    key: occurrenceKey ? `card-preview-${occurrenceKey}` : `card-preview-${pending.playerId}-${pending.cardId}`,
    mood: special?.mood ?? (card.category === 'luck' ? 'happy' : 'mischievous'),
    text: special?.text ?? `${card.category === 'luck' ? 'Sorte' : 'Azar'} para ${playerName(state, pending.playerId)}: ${card.title}.`,
    ...(special?.source ? { source: special.source } : {}),
  };
}

export function messageForMiguelEvent(event: DomainEvent, state: GameState, eventKey?: string): MiguelHostMessage | null {
  const key = eventKey ?? `${event.type}-${JSON.stringify(event)}`;
  switch (event.type) {
    case 'diceRolled':
      return { key, mood: 'happy', text: `Boa, ${playerName(state, event.playerId)}! O dado veio ${event.value}.` };
    case 'turnStarted':
      return { key, mood: 'neutral', text: `Agora é com ${playerName(state, event.playerId)}.` };
    case 'coinsChanged':
      if (event.delta === 0) return null;
      return event.delta > 0
        ? { key, mood: 'happy', text: `${playerName(state, event.playerId)} ganhou ${event.delta} moedas.` }
        : { key, mood: 'mischievous', text: `${playerName(state, event.playerId)} perdeu ${Math.abs(event.delta)} moedas.` };
    case 'minigameStarted':
      return { key, mood: 'happy', text: 'Hora da prova! Mostrem serviço e cuidem dos joelhos.' };
    case 'minigameCompleted':
      return event.winners.length
        ? { key, mood: 'happy', text: `Parabéns, ${event.winners.map(id => playerName(state, id)).join(' e ')}! Vitória bonita.` }
        : { key, mood: 'happy', text: 'Empate bonito! As bananas ficaram sem escolher lado.' };
    case 'goldenBananaPurchased':
      return { key, mood: 'happy', text: `${playerName(state, event.playerId)} levou a banana dourada. Brilha muito!` };
    case 'itemGranted':
      return { key, mood: 'mischievous', text: itemText(event.itemId, state, event.playerId, false) };
    case 'itemUsed':
      return { key, mood: 'mischievous', text: itemText(event.itemId, state, event.playerId, true) };
    case 'cardResolved': {
      const card = CARDS_BY_ID[event.cardId];
      if (!card) return null;
      const special = cardText(event.cardId, state, event.playerId);
      return special
        ? { key, ...special }
        : card.category === 'luck'
          ? { key, mood: 'happy', text: `Sorte para ${playerName(state, event.playerId)}: ${card.title}.` }
          : { key, mood: 'mischievous', text: `Azar para ${playerName(state, event.playerId)}: ${card.title}. A ilha fez cara de paisagem.` };
    }
    case 'attackResolved':
      return { key, mood: 'mischievous', text: `Confronto valendo moedas: ${playerName(state, event.attackerId)} acertou.` };
    case 'attackBlocked':
      return { key, mood: 'happy', text: `Defesa perfeita de ${playerName(state, event.targetId)}. Boa leitura!` };
    case 'attackReversed':
      return { key, mood: 'mischievous', text: `Virada esperta de ${playerName(state, event.targetId)}.` };
    case 'roundStarted':
      return { key, mood: 'happy', text: `Rodada ${event.round} valendo. Vamos nessa!` };
    case 'roundEnded':
      return { key, mood: 'neutral', text: `Rodada ${event.round} fechada. Confiram as bananas.` };
    case 'gameCompleted':
      return { key, mood: 'happy', text: `Fim de jogo! Palmas para ${event.winners.map(id => playerName(state, id)).join(' e ')}.` };
    default:
      return null;
  }
}

export function messageForMiguelPending(state: GameState): MiguelHostMessage | null {
  const pending = state.pending;
  if (!pending || (pending.kind !== 'duelBet' && pending.kind !== 'duelResult')) return null;
  const actor = playerName(state, pending.playerId);
  const opponent = playerName(state, pending.opponentId);
  return pending.kind === 'duelBet'
    ? { key: `pending-duel-bet-${pending.playerId}-${pending.opponentId}`, mood: 'mischievous', text: `Duelo à vista: ${actor} contra ${opponent}. Sem drama, só bananas.` }
    : { key: `pending-duel-result-${pending.playerId}-${pending.opponentId}`, mood: 'mischievous', text: `Duelo aguardando resultado: ${actor} contra ${opponent}. Quem levou as bananas?` };
}

function initialMessage(matchId: string): MiguelHostMessage {
  return { key: `match-start-${matchId}`, mood: 'happy', text: 'Partida valendo! Eu cuido do clima; vocês cuidam das bananas.' };
}

/** Miguel is presentation-only: it never dispatches commands or blocks input. */
export function useMiguelHost({ board, state, enabled, paused }: {
  board: MiguelHostBoard;
  state: GameState;
  enabled: boolean;
  paused: boolean;
}): MiguelHostResult {
  const cursor = useRef<{ matchId: string; seq: number } | null>(null);
  const [message, setMessage] = useState<MiguelHostMessage | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const pendingCursor = useRef<string | null>(null);
  const announcedMatch = useRef<string | null>(null);
  const cardPreviewSeen = useRef<string | null>(null);
  const armedCardPreview = useRef<{ playerId: string; cardId: string } | null>(null);
  const activePriority = useRef(0);
  const activeExpiresAt = useRef(0);
  const activeMessage = useRef<MiguelHostMessage | null>(null);
  const previousSad = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const canPresent = enabled && !paused && documentVisible;
  const sad = useMemo(() => persistentMiguelSad(state), [state]);

  useEffect(() => {
    const latest = board.events
      .filter(event => event.matchId === board.matchId)
      .reduce((max, event) => Math.max(max, event.seq), 0);
    if (!cursor.current || cursor.current.matchId !== board.matchId) {
      cursor.current = { matchId: board.matchId, seq: latest };
      pendingCursor.current = null;
      cardPreviewSeen.current = null;
      armedCardPreview.current = null;
      activePriority.current = 0;
      activeExpiresAt.current = 0;
      activeMessage.current = null;
      previousSad.current = sad;
    }
    const sadnessEnded = previousSad.current && !sad;
    previousSad.current = sad;
    if (sadnessEnded && activeMessage.current?.source === 'ma02') {
      setMessage(null);
      setExpiresAt(null);
      activeMessage.current = null;
      activePriority.current = 0;
      activeExpiresAt.current = 0;
    }
    const result = freshMiguelEvents(board.events, board.matchId, cursor.current.seq);
    cursor.current.seq = result.cursor;
    const pendingCard = state.pending?.kind === 'cardPreview' ? state.pending : null;
    const pendingCardKey = pendingCard ? `${pendingCard.playerId}-${pendingCard.cardId}` : null;
    let newCardPreview: MiguelHostMessage | null = null;
    if (!pendingCard) {
      cardPreviewSeen.current = null;
    } else if (pendingCardKey !== cardPreviewSeen.current) {
      cardPreviewSeen.current = pendingCardKey;
      armedCardPreview.current = { playerId: pendingCard.playerId, cardId: pendingCard.cardId };
      newCardPreview = messageForMiguelCardPreview(state, `${board.matchId}:${state.revision}:${pendingCardKey}`);
    }
    const pendingMessage = messageForMiguelPending(state);
    const pendingKey = pendingMessage?.key ?? null;
    const newPendingMessage = pendingKey !== null && pendingKey !== pendingCursor.current ? pendingMessage : null;
    pendingCursor.current = pendingKey;
    const next = result.fresh
      .filter(event => {
        const armed = armedCardPreview.current;
        if (event.event.type !== 'cardResolved' || !armed) return true;
        if (event.event.playerId !== armed.playerId || event.event.cardId !== armed.cardId) return true;
        armedCardPreview.current = null;
        return false;
      })
      .map(event => ({ event: event.event, message: messageForMiguelEvent(event.event, state, `${event.matchId}:${event.seq}`) }))
      .filter((value): value is { event: DomainEvent; message: MiguelHostMessage } => value.message !== null)
      .sort((a, b) => eventPriority(a.event) - eventPriority(b.event))
      .at(-1);
    const firstWelcome = enabled && state.phase !== 'finished' && announcedMatch.current !== board.matchId ? initialMessage(board.matchId) : null;
    if (firstWelcome) announcedMatch.current = board.matchId;
    const chosen = newCardPreview
      ? { message: newCardPreview, priority: eventPriority({ type: 'cardResolved', playerId: '', cardId: '' }) }
      : next
        ? { message: next.message, priority: eventPriority(next.event) }
        : newPendingMessage
          ? { message: newPendingMessage, priority: 75 }
          : firstWelcome
            ? { message: firstWelcome, priority: 20 }
            : null;
    const now = Date.now();
    const currentActive = activeExpiresAt.current > now;
    if (chosen && canPresent && (!currentActive || chosen.priority >= activePriority.current)) {
      const nextExpiry = now + DISPLAY_MS;
      setMessage(chosen.message);
      setExpiresAt(nextExpiry);
      activeMessage.current = chosen.message;
      activePriority.current = chosen.priority;
      activeExpiresAt.current = nextExpiry;
    }
  }, [board.matchId, board.events, state, enabled, canPresent]);

  useEffect(() => {
    if (!message || expiresAt === null) return;
    if (!canPresent) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      setMessage(null); setExpiresAt(null);
      activeMessage.current = null;
      activePriority.current = 0; activeExpiresAt.current = 0;
      return;
    }
    const timer = window.setTimeout(() => {
      setMessage(null); setExpiresAt(null);
      activeMessage.current = null;
      activePriority.current = 0; activeExpiresAt.current = 0;
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [message, expiresAt, canPresent]);

  const visible = Boolean(message && canPresent && expiresAt !== null && expiresAt > Date.now());
  const mood = sad ? 'sad' : visible ? message?.mood ?? 'neutral' : 'neutral';
  return {
    message,
    messageId: message?.key ?? null,
    text: message?.text ?? null,
    visible,
    mood,
    dismiss: () => {
      setMessage(null); setExpiresAt(null);
      activeMessage.current = null;
      activePriority.current = 0; activeExpiresAt.current = 0;
    },
  };
}
