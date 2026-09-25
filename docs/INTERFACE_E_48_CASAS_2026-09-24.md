# Interface e tabuleiro de 48 casas — 24/09/2026

Aprovado pelo Iago: testar 48 casas em partidas novas, mantendo a imagem da ilha. Salas existentes preservam seu grafo de 36 casas.

## Interface

- TV: mapa ocupa toda a tela; jogador ativo no canto superior esquerdo, rodada/pausa/menu no direito e placar compacto para até 10 jogadores embaixo.
- Histórico, inventário e ajuda do anfitrião ficam no menu. Decisões continuam no celular; resultados presenciais são registrados pelo anfitrião.
- Eventos de sorte/azar continuam visíveis com nome e descrição em sobreposição compacta.
- Celular: removido o bloqueio global de rolagem durante o controle remoto. Cabeçalho, saldos e decisões compactos; placar completo expansível; espaçamento respeita a área segura do aparelho.

## Percurso v5

48 casas: 1 início, 14 ganhos, 10 perdas, 10 sorte, 10 azar e 3 duelos. As 12 casas adicionais ocupam os caminhos existentes. Lojas, árvores e Iagugu continuam paradas entre casas, sem consumir movimento.

Uma volta possível possui 36–37 passos (antes 27–28), pois ramificações são alternativas. Com média de 5,5 por dado, isso equivale aproximadamente a 6,5–6,7 jogadas sem poderes/eventos, não uma duração garantida.

Regras econômicas e catálogo de poderes não foram alterados nesta entrega. Propostas da Milena continuam pendentes de decisão separada.

## Verificação

192 testes automatizados passaram; build TypeScript/Vite passou. Testes cobrem distribuição de 48 casas, comprimento dos percursos, todas as paradas sem gasto de movimento e preservação de saves v4.

Inspeção visual em 1920×1080 e 1366×768 com 10 jogadores. Celular em navegador 390×650: duelo com campo e botão visíveis; placar expandido gera documento de 1170 px e rolagem real de 520 px. A confirmação no Safari do iPhone físico depende do novo teste do usuário.

Prévias: output/tv-hud-48.png, output/tv-hud-48-1366.png, output/celular-duelo-header.png.

Referências de composição: https://play.nintendo.com/explore/super-mario-party-jamboree/ e https://legoparty.com/ . Identidade visual própria preservada.

## Publicação confirmada

Produção: https://sunday-funday-three.vercel.app/ — deployment dpl_2JDMVqZd9d3ExNRA7qbJ5v6SoY1A. Alias público verificado com bundle index-CsnK231D.js.

Integração real passou em sala isolada MMA5HJ: criação com 48 casas, dois jogadores, autorização, cliques concorrentes/duplicados, atualização da TV por WebSocket, recuperação no celular, rodada completa, resultado único e avanço à próxima rodada.

Para testar: atualizar TV e celulares. A interface nova vale também para salas existentes. Criar uma nova sala para jogar com 48 casas.
