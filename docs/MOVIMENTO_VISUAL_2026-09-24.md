# Movimento visual remoto — 24/09/2026

## Diagnóstico

Uma leitura do servidor pode executar até 12 comandos automáticos vencidos. A TV recebe apenas o snapshot resultante; por isso, renderizar `player.nodeId` diretamente faz o peão saltar duas ou mais casas.

Não é seguro reconstruir o caminho pelo grafo. Há bifurcações escolhidas pelo jogador, recuos, paradas entre casas, teleporte para árvore e troca de posição. O evento `movementFinished` informa apenas o destino final.

A fonte exata já presente no snapshot é `player.stepHistory`: cada passo para frente adiciona a origem, e cada recuo remove uma origem. A diferença entre snapshots preserva o percurso real mesmo quando `movement` já voltou a `null`. `movement.transit` identifica uma parada real entre duas casas. Quando o histórico é zerado por teleporte/troca, a apresentação sincroniza diretamente e não inventa casas intermediárias.

## Contrato de integração

```tsx
const visualState = { ...state, map: layoutBoardForRender(state.map) };
const motion = useBoardMotion(board.matchId, visualState, { paused: board.paused });

<Board state={motion.state} living={living} paused={board.paused} highlightNodes={pathOptions} />

// Para a câmera, use coordenadas normalizadas; paradas não têm nodeId.
const cameraStyle = motion.focus
  ? { transform: `scale(1.04) translate(${(0.5-motion.focus.x)*3}%, ${(0.5-motion.focus.y)*3}%)` }
  : undefined;
```

`motion.state` apresenta cada destino em sequência. `BoardV4` lê o frame anexado a esse estado para desenhar o arco de salto e aterrissagem. Na montagem inicial/reconexão, o snapshot atual vira a linha de base e não é repetido. Com `prefers-reduced-motion: reduce`, a fila é descartada e o estado atual aparece imediatamente.

Use o `state` canônico no HUD, placar e painéis. `motion.state` é exclusivo do `<Board>`: durante uma fila que atravessa a virada de turno, seu `activeIndex` aponta temporariamente para o dono do passo visual. A opção `paused` e uma aba oculta descartam a fila e adotam o snapshot mais recente; ao voltar, não há replay acumulado.

Na TV real, `layoutBoardForRender` roda antes do hook para que tabuleiro, foco da câmera e arco usem as mesmas coordenadas. O áudio também usa o estado canônico. Sua `stepKey` permanece estável durante o salto e muda somente quando `motion.frame.phase === 'land'`, produzindo um efeito por aterrissagem sem repetir `movementFinished`.

## Limite consciente

Snapshots antigos sem `stepHistory` completo permitem saber que houve mudança, mas não quais casas foram atravessadas. Nesse caso o hook faz sincronização direta. Isso evita uma rota visual incorreta e não muda regras, comandos ou persistência do servidor.
