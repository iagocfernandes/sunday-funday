# Direção de vídeo do AR2 — 27/09/2026

## Entrega local desta rodada

- Três cenas geradas no Gemini web, revisadas e integradas: `ar2-welcome.mp4`, `ar2-banana.mp4` e `ar2-mischievous.mp4`, em `public/assets/host/video/`. Aproximadamente 10 segundos por arquivo; a duração visível acompanha a apresentação existente, sem prolongar a partida.
- Arquivos H.264 em 1280×720, sem trilha sonora, com carregamento progressivo. A voz WAV aprovada permanece inalterada. Os vídeos são reações, sem sincronização labial.
- Abertura/guia usa boas-vindas; compra de banana usa celebração; azar/roubo usa reação sacana. Campeão reutiliza temporariamente a celebração da banana. Sobriedade mantém a expressão triste aprovada.
- Vídeo triste e campeão exclusivo pendentes: Gemini informou limite da conta e nova disponibilidade em 27/09 às 16h52. Não houve upgrade.
- Prévia: `/design/?tab=host`. As frases dessa galeria são propostas; a partida usa instruções com os dados reais de caminhos, loja, árvore, Iagugu e duelo.
- Orientação consultada: [Scenario Gemini Omni](https://github.com/scenario-labs/skills/blob/main/skills/scenario-gemini-omni/SKILL.md) e [Scenario Veo](https://github.com/scenario-labs/skills/blob/main/skills/scenario-veo/SKILL.md). Geração feita diretamente no Gemini, sem conexão Scenario.
- Validado: 312 testes passaram, build de produção e revisão visual da prévia. Ainda não publicado na Vercel.

As durações abaixo são alvos de direção para futuras gerações, não durações dos arquivos entregues nesta rodada.

## Objetivo

Dar ao AR2 uma presença curta e recorrente na TV: ele conduz a leitura da
partida, reage ao que acabou de acontecer e devolve o foco ao tabuleiro. Os
cortes são opcionais, curtos e independentes da regra. Movimento normal do
peão, espera do celular e decisões de jogador não devem abrir uma pausa só
para tocar vídeo.

O personagem de referência é sempre o mesmo gorila dourado adulto, corpulento,
com cabelo curto, pelo mel, peitoral metálico, couro marrom e tecido vinho:

- referência de rosto/corpo: `public/assets/host/miguel-reference.png`;
- prancha de expressões aprovadas: `public/assets/host/miguel-expressions.png`;
- direção geral de personagens: `public/assets/references/personagens-oficiais.png`;
- linguagem de interface: `public/assets/references/direcao-tropical-bold.png`.

“Miguel” permanece apenas como nome técnico de componentes/arquivos legados.
Na tela e nos prompts, o anfitrião é **AR2**.

## Ordem de produção: cinco cenas

| Prioridade | Cena curta | Gatilho exato existente | Áudio aprovado | Duração alvo |
| --- | --- | --- | --- | --- |
| 1 | **Boas-vindas e guia** | Criação da sala/partida: `selectHostAudioCue(null, game, [])` abre `opening` em `startBoard`; para cada `turnStarted`, usar a reação visual do jogador sem criar nova fala | `opening.wav` na abertura; o turno usa somente texto/sprite e não bloqueia | 4–6 s; reação de turno 1–2 s |
| 2 | **Celebração da banana** | Evento `goldenBananaPurchased` confirmado pelo motor, com `playerId` | `banana-bought.wav` / `bananaBought` | 3–4 s |
| 3 | **Azar/roubo sacana** | `bananaStolen` quando há delta real de banana dourada (carta `MS01` ou roubo do Iagugu); para azar comum, evento `cardResolved` de carta `unluck` seleciona `unluck` | `banana-stolen.wav` ou `unluck.wav`, conforme a seleção já feita | 2–3 s |
| 4 | **Fique sóbrio** | Evento `cardResolved` com `cardId: 'MA02'`; depois do corte, manter expressão triste estática enquanto `persistentMiguelSad(state)` for verdadeiro | `sober.wav` / `sober` | 3 s; estado triste sem novo vídeo |
| 5 | **Campeão** | Evento `gameCompleted` com exatamente um vencedor (`winners.length === 1`) | `champion.wav` / `champion` | 4–5 s |

### Regras de encenação

1. A cena começa depois que o evento aparece no snapshot, nunca antes do
   resultado lógico. Nome, retrato, quantidade de moedas e texto continuam
   sendo desenhados pela interface.
2. O corte é uma reação de câmera fixa: enquadramento médio/close do AR2,
   fundo tropical adulto e brincalhão, gesto simples e legível, sem travelling,
   sem montagem rápida e sem texto gerado dentro do vídeo.
3. A fala WAV continua sendo a fonte oficial. Não gerar fala no Gemini/Veo,
   não pedir sincronização labial e não animar a boca para “casar” com o WAV.
   O gorila pode respirar, piscar, levantar uma banana, fazer um gesto ou
   mudar a expressão.
4. `opening`, compra, roubo, azar, sobriedade e campeão mantêm o comportamento
   de áudio já aprovado: a apresentação sonora pode segurar o próximo passo e
   libera por término, Pular, erro, mute, autoplay bloqueado ou timeout. O
   vídeo deve acompanhar essa janela, mas nunca prolongá-la.
5. Caminhada entre casas, aterrissagem visual, turnos, espera de decisão,
   janela de item e reconexão continuam sem pausa forçada por vídeo. Na falta
   de arquivo, erro de carregamento ou `prefers-reduced-motion`, mostrar o
   sprite aprovado correspondente e continuar o jogo.
6. Vitória empatada não recebe a fala `champion` porque o catálogo atual só a
   seleciona para um vencedor. Usar o estado final existente e sprite neutro;
   isso não cria regra de desempate.

## Prompts reutilizáveis para Gemini/Veo

Para cada geração, enviar como imagem de referência principal
`public/assets/host/miguel-reference.png` e, quando for necessário fixar a
expressão, `public/assets/host/miguel-expressions.png`. Repetir o bloco abaixo
literalmente em todos os prompts para reduzir deriva de personagem:

> Use exatamente o mesmo AR2 da imagem de referência: gorila dourado adulto,
> corpulento, rosto largo e amigável, cabelo curto dourado, pelo cor de mel,
> peitoral de metal envelhecido com detalhes de leão, couro marrom e tecido
> vinho. Preserve rosto, proporções, figurino, cores e acessórios entre todos
> os frames. Estilo tropical de aventura para adultos, brincalhão e caloroso,
> realismo 3D estilizado, luz quente de ilha, sem mascote infantil, sem novo
> personagem e sem redesign de armadura. Plano fixo, câmera travada, fundo
> tropical discreto, 24 fps, 16:9, clipe curto de reação, movimento corporal
> simples, sem texto, sem logotipo, sem cortes, sem zoom, sem panorâmica e sem
> lip sync. A boca pode permanecer fechada ou fazer uma expressão natural; o
> áudio oficial será sobreposto depois. Entregar também um frame final limpo
> que funcione como fallback estático.

Adicionar uma ação específica por cena:

1. **Boas-vindas e guia:** AR2 entra no enquadramento, aponta para o tabuleiro
   fora de quadro, olha para a câmera e faz um aceno confiante; termina com
   sorriso convidando os jogadores a acompanhar o mapa.
2. **Banana:** AR2 ergue uma banana dourada, arregala os olhos e comemora com
   um pequeno punho no ar; brilho da banana discreto e sem alterar o design do
   tabuleiro.
3. **Azar/roubo:** AR2 olha para os lados, esconde uma banana atrás das costas
   e faz uma sobrancelha sacana; para azar sem roubo, troca o gesto por um
   encolher de ombros divertido.
4. **Sobriedade:** AR2 baixa os ombros, segura um copo de água ou aponta para
   água disponível na ilha, faz expressão triste carinhosa e termina olhando
   para o jogador; sem bebida alcoólica visível.
5. **Campeão:** AR2 aponta para o vencedor fora de quadro, abre os braços em
   aplauso e levanta a banana dourada; termina em pose de celebração clara,
   reservada ao vencedor único.

## Contrato de entrega dos arquivos

- Exportar cinco vídeos locais curtos, com nomes estáveis correspondentes às
  chaves `abertura`, `dourada`, `azar-roubo`, `sobrio` e `campeao`.
- Entregar para cada vídeo um PNG de fallback do mesmo frame/expressão e um
  `durationMs` realista. O vídeo não deve conter a fala, música ou efeitos.
- Não publicar o arquivo como aprovado apenas por ter sido gerado: revisar
  primeiro continuidade do rosto, mãos, boca, armadura, ausência de texto e
  compatibilidade 16:9.

## Gaps de código encontrados

- `src/presentation/manifest.ts` aponta para `assets/scenes/abertura.mp4`,
  `dourada.mp4` e `vitoria.mp4`, mas esses arquivos não existem em
  `public/assets/scenes/`. Os PNGs atuais (`gorila-heroi.png` e
  `gorila-jovem.png`) são fallback genérico e não são os cinco cortes do AR2.
- `src/components/SceneOverlay.tsx` já trata vídeo, erro, autoplay, redução de
  movimento e fallback, mas só é montado no fluxo local em
  `src/screens/GameScreen.tsx`. O tabuleiro remoto usa `useRemoteScenes` e,
  em `src/remote/BoardRemote.tsx`, renderiza apenas `tv-event`/`tv-event-splash`;
  nenhum vídeo é montado na TV remota.
- `src/components/MiguelHost.tsx` e `miguel-host.css` exibem o sprite de quatro
  expressões e o fallback `miguel-reference.png`. Eles não têm uma camada de
  vídeo nem uma chave de cena. A integração deve preservar esse caminho de
  fallback, inclusive quando o vídeo falhar.
- O servidor já fornece o contrato correto para áudio (`BoardPresentation`),
  deduplica eventos e pausa somente enquanto a apresentação sonora existe
  (`server/board.ts`). Não acoplar vídeo a `advanceBoard` nem criar
  apresentação para `movementFinished`, `turnStarted` ou cada aterrissagem.
- `src/presentation/hostAudioCues.ts` já cobre os cinco gatilhos relevantes,
  com exceções intencionais: `champion` apenas para vencedor único, roubo só
  com delta real de banana e `MA02` com prioridade sobre azar genérico. O
  vídeo deve consumir essa mesma decisão, sem duplicar heurísticas no cliente.

## Critério de aceite

Uma partida remota iniciada pelo host deve mostrar a abertura, reagir uma vez a
cada compra/roubo/azar/sobriedade e encerrar com campeão quando aplicável. Se
qualquer MP4 estiver ausente, quebrado, mutado ou reduzido, o mesmo evento ainda
deve mostrar o sprite AR2 e o WAV deve liberar a partida pelo caminho existente.
Durante uma sequência de passos comuns, o peão continua andando e o celular
continua utilizável sem esperar uma cena de vídeo.
