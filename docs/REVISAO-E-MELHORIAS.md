# Revisão do Sunday Funday e o GameDev OS da Scenario

Data da revisão: 25 de setembro de 2026. A festa é em 27/09. Este documento é diagnóstico e proposta. Não instala o GameDev OS e não muda regras nem arte.

## Resumo do jogo

Sunday Funday é o tabuleiro da festa dos gorilas. De dois a dez jogadores entram pelo celular, rolam o dado e decidem caminho, loja, poderes e apostas. A TV mostra a ilha, o placar e as falas do anfitrião AR2. O anfitrião registra o resultado das provas presenciais. Vence quem junta mais bananas douradas; moedas desempatam.

Há um segundo modo, em `/?mode=local`: a partida inteira roda no computador do anfitrião, com automação, pausa, desfazer e backup em JSON. O README ainda descreve esse modo como se fosse o produto principal. A entrada padrão do aplicativo, sem query string, é a sala da TV.

Não é um jogo de engine (Unity, Unreal, Godot, Phaser). É um aplicativo web:

- cliente em React 18, TypeScript e Vite 5;
- tabuleiro em SVG sobre a ilustração `public/assets/board/ilha-v4-2x.webp`;
- motor puro em `src/game/engine.ts`, testado com Vitest;
- salas remotas em funções Vercel (`api/room.ts`, `api/socket.ts`), WebSocket e Upstash Redis.

O loop de uma rodada, no modo da festa:

1. A TV cria a sala e mostra o QR. Dois a dez celulares entram com nome e, se quiserem, foto.
2. O anfitrião começa. A ordem é sorteada no servidor. O dado também: o celular pede a rolagem, o motor no servidor sorteia.
3. O peão anda sozinho. O jogo para em bifurcação, loja, árvore da banana, Iagugu, carta com alvo, duelo e prova.
4. No fim da rodada há uma prova presencial. O anfitrião lança o resultado uma vez e só então abre a rodada seguinte.
5. Depois da última rodada, o pódio.

Mapa novo: `ilha-dos-gorilas-v5`, 48 casas (início, ganhos, perdas, sorte, azar e três duelos). Lojas, quatro árvores do Fábio e o Iagugu ficam entre casas e não gastam passo. Salas antigas guardam o mapa com que foram criadas.

Economia que o código usa hoje, ainda marcada como proposta em `src/data/config.ts`: 8 rodadas no jogo novo e 2 na demonstração, dado 1–10, 10 moedas iniciais, banana a 20, casa boa +3, casa ruim até −3, +10 ao passar pelo início numa volta normal. A loja vende seis poderes a 5 moedas: Dado Duplo, Dado Certeiro, Troca-Troca, Muda a Banana!, Gorila Preguição e Gorila Blindado. O documento das cartas da Milena fala em 10 moedas. O código cobra 5. Isso precisa de uma decisão antes de imprimir ou de explicar a regra em voz alta.

## Diagnóstico

### O que foi executado nesta revisão

| Verificação | Resultado |
|---|---|
| `npm test` | 265 testes, 23 arquivos, todos passaram |
| `npm run build` | Typecheck do cliente e do servidor, build Vite, passou |
| `http://127.0.0.1:5173/` | Tela “Vamos jogar Sunday Funday?” abre |
| Criar partida no tabuleiro, neste ambiente | Falha com “O servidor está indisponível por um momento. Tente novamente.” |
| `/?mode=local`, demonstração de 8 gorilas | Preparação, tabuleiro, “Iniciar rodada”, dado da Júlia (5), parada na Barraca da Praia, Passar, −3 moedas, turno seguinte |
| Console do modo local | Sem erro de JavaScript e sem imagem quebrada nessa passagem |
| `http://127.0.0.1:5173/design/` | Design Studio abre |
| `https://sunday-funday-three.vercel.app/` | A página publicada responde. Não foi criada sala nova lá |

A falha ao criar sala aqui não é um bug de regra. O Vite encaminha `/api` para `127.0.0.1:3001`, e esse processo não estava no ar. Mesmo com `npm run remote:api`, a sala exige Redis (`KV_REST_API_URL` ou `UPSTASH_REDIS_REST_URL`). Essas variáveis não estão no repositório, de propósito. Sem banco, o cliente recebe resposta vazia e mostra a mensagem genérica de servidor indisponível. O modo local não depende disso.

Não houve ensaio em TV física nem em celular de verdade nesta rodada. Os documentos de 24/09 registram um ensaio publicado (sala isolada, rodada completa, WebSocket). Isso não substitui um ensaio na véspera, com a build que está no ar agora.

### O que já funciona

- Motor de turno, dado, movimento, bifurcação, loja, banana, Iagugu, duelo, cartas digitais da Milena, Blindado, provas e ranking.
- Persistência local com validação de backup e desfazer preso à partida.
- Sala remota autoritativa: o cliente não manda saldo nem resultado de dado.
- Ilha aprovada, seis poderes com arte, três gorilas oficiais (Arthur, Mari, Milena), fotos quadradas no celular.
- AR2 na TV: oito falas gravadas (abertura, banana comprada, banana roubada, última rodada, campeão, sorte, azar, fique sóbrio) e uma trilha procedural com marimba, baixo e percussão. O som só começa depois de um gesto na TV.
- Camadas leves de água, copas e cachoeira por cima da imagem, não um cenário 3D.

### O que está inacabado ou frouxo

- O README ainda diz que não há backend, conta nem celular. A home local chama o fluxo da TV de “teste”. Quem abrir o repositório na pressa segue a instrução errada.
- A sequência de provas é calculada e mostrada. Não dá para escolher a prova de cada rodada na preparação.
- O checkbox “Ativar ladrão” na preparação local não faz o ladrão. Com a opção ligada, a casa `thief` só encerra o turno. O roubo de verdade é o Iagugu, entre casas, no mapa novo. Ligar o checkbox passa a impressão de uma regra que não existe.
- Preço da loja: 5 no código, 10 no texto da Milena. Premiação de prova e quantidade de rodadas continuam propostas.
- As 13 cartas têm nome, texto e efeito. A apresentação é moldura em CSS, não uma ilustração por evento.
- Faltam as falas de duelo e de vitória de minigame. O código pede esses clipes e os descarta de propósito, porque os arquivos aprovados não existem. A fala de campeão não é reaproveitada no minigame.
- A trilha é síntese do navegador. Serve para a festa. Não é uma gravação.
- Só três personagens têm sprite oficial. No modo da TV a foto do jogador cobre boa parte dessa falta. No modo local, o resto cai no retrato genérico.
- O Design Studio ainda tem uma galeria com o título “MIGUEL · ANFITRIÃO”. Na partida, o nome visível já é AR2. O código interno (`useMiguelHost`, `MiguelHost.tsx`) guarda o nome antigo.
- Vários documentos em `docs/` descrevem etapas já superadas (36 casas, sem celular, ladrão desligado como se fosse a regra viva). O arquivo mais novo nem sempre está marcado como fonte vigente.
- O piscar das casas na TV foi mitigado em 25/09 e não reproduziu neste desktop. A confirmação continua dependendo do aparelho da festa.
- Itens antigos (Escudo, Casca, Reverse, Banana Turbo, Mão no Bolso) continuam no motor por causa de saves e testes. Não estão na loja atual.

Nada disso impede a demonstração local de rodar. O que impede a festa de acontecer neste checkout, sem deploy, é a ausência do Redis. A festa prevista usa o site publicado.

## O que o GameDev OS realmente é

Post de Emmanuel de Maistre, cofundador da Scenario, em 24/09/2026: [GameDev OS by Scenario](https://x.com/emmanuel_2m/status/2103097017073361137). O texto anuncia 9 especialistas e 64 skills, de instalação gratuita, e pede para comentar “OS” para receber a biblioteca. Não há, no post, um link de repositório.

Não existe um repositório público chamado GameDev OS. O artefato aberto que corresponde ao anúncio é [scenario-labs/skills](https://github.com/scenario-labs/skills), licença MIT, também listado em [skills.sh/scenario-labs/skills](https://www.skills.sh/scenario-labs/skills). Em 25/09 a página contabilizava **65** skills. O changelog `0.47.0`, do mesmo dia, acrescentou `scenario-orbit-views`. O “64” do post é a contagem da véspera, não um segundo pacote.

Os 9 especialistas do post não são 9 agentes instaláveis. Em `.claude/agents` do repositório só há revisores de manutenção das próprias skills. A árvore do post é um jeito de agrupar skills que já existem. A correspondência, pelo que cada skill declara:

| Especialista do post | Skills públicas que cobrem o papel |
|---|---|
| 2D Artist (sketches, sprites, VFX) | `scenario-image`, `scenario-game-assets`, `scenario-sprite-animation`, `scenario-gpt-image` |
| 3D Artist (image-to-3D, rigging) | `scenario-3d`, `scenario-meshy`, `scenario-rodin`, `scenario-sparc3d` |
| Environment Artist (texturas, skybox, mundo andável) | `scenario-textures`, `scenario-skyboxes`, `scenario-3d-worlds` |
| Art Director (o mesmo personagem em vários planos, QA antes de publicar) | `scenario-consistency`, `scenario-identity-library`, `scenario-quality-gate`, `scenario-asset-analysis`, `scenario-refine-loop` |
| Sound Designer (trilha e SFX) | `scenario-audio`, `scenario-elevenlabs`, `scenario-minimax-music`, `scenario-ace-step`, `scenario-sonilo` |
| Video Producer (trailer e legendas) | `scenario-video`, `scenario-seedance`, `scenario-video-assembly`, `scenario-caption-studio` |
| Marketing Artist (store art e anúncio) | `scenario-formats`, `scenario-video-ads`, `scenario-product-shots`, `scenario-brand-kit` |
| Technical Director (ComfyUI e pipelines) | `scenario-workflow-authoring`, `scenario-workflows` |
| Cost Manager (bake-off e orçamento) | `scenario-model-comparison`, `scenario-team-admin`, `scenario-admin-analytics` |

O que a skill faz: ensina o agente (Cursor, Claude Code, Codex e outros) a falar com o [Scenario MCP](https://mcp.scenario.com/mcp). O ciclo é descobrir o modelo, ler o schema, orçar com `dry_run`, gerar, esperar, baixar PNG, WAV, MP3, MP4 ou GLB. A skill não compila o Sunday Funday e não conhece o motor.

### O que custa

Instalar a skill é de graça: `npx skills add scenario-labs/skills --skill "*"`. Gerar alguma coisa não é.

É obrigatória uma conta em [app.scenario.com](https://app.scenario.com). O MCP autentica por OAuth ou por chave de API. Cada imagem, vídeo, malha, áudio ou treino gasta créditos (compute units). A página de preços, consultada em 25/09/2026:

- plano grátis: 50 créditos por dia, sem cartão. Saídas só para uso pessoal e avaliação. Licença comercial fica nos planos pagos;
- Starter: US$ 15/mês, 1.500 créditos;
- Pro: US$ 45/mês, 5.000 créditos, treino de modelo próprio e fila melhor;
- Max: US$ 75/mês, 10.000 créditos.

Créditos do plano não acumulam para o mês seguinte. Vídeo (Seedance e outros), 3D (Meshy, Rodin) e música gastam muito mais que um still. Seedance, GPT, Meshy e Rodin entram pelo catálogo da Scenario: não apareceu, na documentação pública, a exigência de uma segunda conta nesses fornecedores. O gasto sai dos créditos da Scenario. Modelos avançados e treino próprio podem estar só no Pro para cima. O `dry_run` mostra o preço antes de gastar. A estimativa às vezes erra para baixo. O próprio guia das skills registra um caso orçado em 48,2 unidades e cobrado em 55.

Para esta festa, o plano grátis mal dá para alguns stills por dia. Um trailer ou um mundo 3D estoura essa cota rápido. E a licença grátis não cobre uso comercial, se um dia o jogo for publicado como produto.

### Compatível com este jogo?

Compatível como fornecedor de arquivo, não como engine.

O Sunday Funday consome PNG, WebP e WAV em `public/assets/`, desenhados por CSS e SVG. Um PNG de carta ou um WAV de dado podem entrar sem mudar o motor. Um GLB, um FBX, um skybox ou um splat não têm onde sentar: o tabuleiro não carrega malha. A frase “gorilas dourados 3D estilizados” no Design Studio descreve a pintura de referência (pelo, metal, couro), não um mundo jogável em 3D.

A cadeia do post (2D desenha a arma, 3D modela, ambiente constrói o mundo, som põe o tiro, vídeo corta o trailer) é o pipeline de um jogo de ação. Aqui a cadeia útil é outra: a ilha e os três gorilas já aprovados viram referência, o 2D gera cartas e ícones no mesmo traço, o som troca oscilador por sample, e alguém olha o resultado antes de substituir o arquivo. Sem diretor de arte no loop, a geração briga com a arte que o Iago já aprovou.

Cursor consegue usar as skills se o MCP da Scenario estiver conectado na conta de quem gera. Isso fica fora deste repositório. Instalar o pacote aqui nesta rodada foi descartado de propósito.

### Alternativas olhadas

[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) é um catálogo grátis de skills de código para Godot, Unity, Unreal, Phaser, PixiJS e three.js. Não gera arte e não cobra API. O Sunday Funday não usa nenhuma dessas engines. Serve, no máximo, como cola de boas práticas de áudio e interface. Não substitui o pacote da Scenario e não vale a pena instalar agora.

[Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) é um estúdio de processo para Claude Code: dezenas de agentes, skills de GDD, história e QA, com especialistas de Godot, Unity e Unreal. Também é grátis e também não gera PNG nem WAV. Para um tabuleiro que já está em véspera de festa, o processo é maior que o problema.

Nenhum dos dois escreve regra de banana dourada.

## O que cada frente resolve

### Melhora com as skills da Scenario

Útil depois que a regra da festa estiver fechada, e só com orçamento combinado:

- ilustração individual das 13 cartas, com o texto continuando em HTML;
- samples curtos no lugar dos osciladores (dado, passo, moeda, banana, poder, sorte, azar, vitória), mantendo o contrato de `useGameAudio`;
- as duas falas que faltam, duelo e vitória de prova, no mesmo timbre de `public/assets/audio/ar2/`;
- mais expressões ou um pôster da festa, se sobrar crédito e se a referência oficial for a âncora.

O Art Director e o Cost Manager entram aqui como freio: comparar modelo com `dry_run`, gerar pouco, rejeitar o que não parecer a ilha aprovada. Não treinar um modelo próprio para uma festa de um dia. O plano grátis não chega nesse volume com folga, e o Pro é que libera treino.

### Não cabe neste jogo

Image-to-3D, rig, retarget, textura PBR, skybox, mundo 3D andável, trailer de loja, anúncio, store art, importação de grafo ComfyUI. Isso produz arquivos que o tabuleiro não exibe, ou peças de marketing de um produto que não está à venda. Fazer essa cadeia agora atrasa a festa e gasta o crédito que serviria para as cartas.

### Independente de ferramenta paga

Tudo que decide se a festa funciona:

- uma página de operação para quem está na TV;
- ensaio de uma rodada de verdade no endereço publicado, com dois celulares;
- decidir rodadas, preço da loja e a prova de cada rodada;
- esconder ou rotular o ladrão que não existe;
- não redesenhar a ilha.

## Lista priorizada

Impacto pensado para domingo, 27/09. Esforço é tamanho da mudança, não calendário.

| # | Melhoria | Impacto | Esforço | Depende de ferramenta paga? |
|---|---|---|---|---|
| 1 | Guia de uma página do anfitrião e correção do README. Dizer que a festa abre em `/?remote=tv` no site publicado, que o celular entra pelo QR, e que `/?mode=local` é o fallback sem internet. Incluir pausa, carta, duelo, prova, backup e o que fazer se a sala não conectar. | Alto. Evita operar a festa pelo documento errado. | Baixo. Só texto. | Não |
| 2 | Ensaio de uma rodada no endereço publicado, com TV e dois celulares: dado, bifurcação, loja, uma carta, uma pausa, recarregar a TV, registrar a prova uma vez. Anotar só o que quebrar. | Altíssimo. É o único teste que o automatizado não faz. | Médio. É gente e aparelho, não um refactor. | Não |
| 3 | Fechar os números da festa e o ladrão fantasma. Escolher rodadas, preço (5 ou 10) e a ordem das provas. Na preparação local, desabilitar o checkbox do ladrão com a frase “o roubo é o Iagugu”. Não implementar um segundo ladrão. | Alto. A regra falada e a regra cobrada precisam ser a mesma. | Baixo a médio. Configuração e um controle de UI. | Não |
| 4 | Ilustrar as 13 cartas sem trocar o texto nem o efeito. Referência: `personagens-oficiais.png` e a ilha. Orçar com `dry_run`, gerar um lote pequeno, olhar na TV, só então copiar os PNG para `public/assets`. | Médio na festa, alto no acabamento. A carta já funciona em CSS. | Médio, mais o tempo de revisão visual. | Sim. Créditos Scenario. Plano grátis é curto e sem licença comercial. |
| 5 | Trocar a trilha procedural e os SFX de oscilador por samples locais, e gravar as falas de duelo e de vitória de prova que o código já espera. O hook de áudio permanece. Sem sample aprovado, o jogo continua com o som atual. | Médio. O som atual já toca. A fala que falta é o buraco mais audível. | Médio. | Sim, se a geração for na Scenario. Um arquivo gravado por fora também serve e não gasta crédito. |

Ficam de fora desta lista, de propósito: mundo 3D, rig, skybox, trailer, store art, pipeline ComfyUI, e instalar o pacote de skills dentro do repositório.

## Primeira rodada de implementação

Quando for a hora de codar, a rodada é esta, nesta ordem. Esta revisão não executa a rodada.

1. Escrever o guia do anfitrião em `docs/` e alinhar o README e o link “teste” da home local. Sem mudar regra.
2. Combinar com o Iago os três números: rodadas, preço dos poderes, provas do dia. Aplicar só o que ele confirmar. Desabilitar o checkbox do ladrão.
3. Rodar o ensaio do item 2 da tabela no site publicado. Corrigir somente o que impedir de terminar uma rodada.
4. Só se sobrar crédito e vontade: um lote de cartas e, se couber, os dois clipes de voz. Nada entra no jogo sem a pessoa olhar em tela cheia. A ilha `ilha-v4.png` não é regenerada.

Critério para parar a rodada: uma sala nova no site publicado completa uma rodada com dois celulares, a prova entra uma vez, recarregar a TV não rerrola o dado, e o papel do anfitrião cabe numa página.

## Correções neste pull request

Nenhuma alteração de código. O jogo local inicia, rola o dado e resolve a loja. A sala remota falha neste ambiente porque o Redis não está configurado, e a interface já avisa. Isso não é um defeito pequeno e seguro para “consertar” no escuro: apontar o cliente para outro backend mudaria o deploy da festa.
