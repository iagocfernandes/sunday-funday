# Revisão do Sunday Funday — 23 de setembro de 2026

## Conclusão

O projeto tem uma base funcional de regras e automação, mas ainda não está pronto para o ensaio final da festa. A prioridade é corrigir recuperação/resultados e integrar a direção visual aprovada ao jogo real. O cenário com personagens novos está numa demonstração separada, `public/previa-tabuleiro.html`.

Nesta revisão: leitura de motor, persistência, automação, componentes de resultados, configuração, assets e documentos; 67 testes passaram e build passou. A inspeção visual anterior confirmou movimento automático e pausa numa bifurcação. Não foi feita nesta revisão uma nova partida completa, nem teste físico em TV. Os problemas abaixo foram identificados por inspeção de código; testes verdes não cobrem todos esses casos.

## Correções antes de usar numa festa

### P1 — Desfazer pode restaurar outra partida

`src/persistence/storage.ts` guarda a pilha numa única chave global. `src/App.tsx` inicia/importa outra partida sem limpar ou separar essa pilha; `useGameSession` consulta a profundidade existente. Criar uma nova partida após jogar outra e clicar Desfazer pode restaurar estado da partida anterior.

Correção: vincular snapshots de undo ao gameId e validar o ID ao restaurar; limpar a pilha ao criar/importar uma partida diferente. Testar A → sair → criar B → desfazer, incluindo backup importado.

### P1 — Importação não valida o estado completo

`parseImport` acessa `state.map.nodes` sem validar a estrutura aninhada; saldo inválido que não seja negativo, fase arbitrária, itens desconhecidos e índices ausentes podem passar pelas verificações. Estruturas erradas também podem lançar exceção fora do catch do JSON. `loadSnapshot` normaliza sem essa validação; o snapshot anterior é escrito, mas não é usado como recuperação.

Correção: validar estruturas, enums, números finitos inteiros, inventários, fase/pendência e referências antes de aceitar. Reutilizar validação em importação e retomada; oferecer snapshot anterior válido se o atual falhar. Garantir que rejeitar não substitui o último estado válido.

### P1 — Resultados individuais podem contradizer a posição escolhida

`MinigamePanel` permite colocar alguém na segunda posição sem preencher a primeira. O cálculo percorre grupos vazios sem avançar a posição, podendo premiar esse grupo como primeiro. Rótulos da interface e histórico usam índice + 1, que também diverge do ranking competitivo em empate (1º, 1º, 3º).

Correção: uma representação única de posições compartilhada por motor, formulário, revisão e histórico. Recusar lacunas ambíguas ou normalizar explicitamente antes da confirmação. Testar primeiro grupo vazio, empate no primeiro e edição antes de confirmar.

### P2 — Bloqueio de duas abas não garante posse exclusiva

Renovação grava o lock sem conferir proprietário. Após outra aba assumir, a anterior pode continuar executando e sobrescrever o lock. O dispatch não bloqueia por conflito e a aba que assumiu a partir de conflito mantém callback de renovação condicionado ao resultado inicial.

Correção: validar posse antes de comandos/gravações, detectar mudança de proprietário, pausar a aba antiga e renovar somente se ainda for dona. Testar duas abas e tomada de controle. Para o evento, operar uma única aba até concluir a correção.

### P2 — Ladrão selecionável, mas sem ação implementada

Em `engine.ts`, a casa thief termina o turno mesmo quando `thiefEnabled` está ligado. A opção no setup sugere uma capacidade inexistente.

Correção de escopo mínimo: remover/desabilitar o controle com indicação de indisponível. Implementar roubo somente depois de confirmar preço, alvos e defesa; não é requisito para validar a primeira partida.

## Aderência às regras e operação

- Beerpong é descrito como duplas, mas o sistema organiza apenas duas equipes. Definir se será torneio de 4–5 duplas ou duas equipes grandes e implementar o registro correspondente. Com nove pessoas, explicitar rodízio/formato.
- Cadastro de minigames contém pontaria, cabo de guerra e revezamento, mas não Dixit, Jamboree, Time’s Up e tênis discutidos. Esses substitutos não devem virar programação oficial por acidente.
- Sequência de provas é calculada e exibida, não editável no setup. Adicionar escolha da prova e formato por rodada.
- `setTeams` não exige todos os jogadores nem equipes não vazias; `submitResults` não valida correspondência do formato com a prova e índice da equipe vencedora. Garantir participantes únicos e completos e resultado válido no motor.
- Rascunho de resultados individuais vive em estado React e desaparece ao recarregar. Persistir rascunho ou avisar claramente que ainda não foi registrado.
- Moedas compram itens/bananas de ouro; bananas de ouro vêm primeiro na classificação, moedas desempatam. Essa regra está implementada. Desempate absoluto ainda mostra múltiplos campeões; decidir se compartilharão vitória ou haverá prova extra.
- Preços, oito rodadas, limite de itens e premiações são propostas. Fechar antes de imprimir cartas; um minigame por rodada e automação são confirmados.

## Visual e interação

### Integrar a prévia ao aplicativo

A prévia tem cenário e sprites novos, mas posições, cores e movimento são próprios e não seguem o motor. O jogo mantém mapa antigo, duas bifurcações e retratos circulares. A prévia mostra circuito único com 36 casas. Escolher um grafo final antes de integrar: não eliminar bifurcações silenciosamente, nem posicioná-las sobre água para conservar o código antigo.

Recomendação para a próxima entrega: levar o cenário e os personagens para o componente Board, ler coordenadas e tipos de um único mapa e acionar as mesmas decisões do motor. Preservar backups antigos com mapId/version próprios. Evitar manter dois tabuleiros editados independentemente.

Definir sprite + retrato por personagem e seleção no setup. Ainda há somente três personagens personalizados. Usar os genéricos existentes para os demais até produzir suas artes; não prometer dez personalizados.

Em casas ocupadas, manter bases identificáveis e disposição compacta; o gorila ativo fica destacado. Ordenar personagens pela posição vertical dos pés. Testar especialmente a casa inicial com dez peças. Ajustar tamanho na TV, sem comprometer números e casas ao fundo.

### Livro e cartas como apresentação principal

Atualizar o plano para refletir a decisão mais recente: vídeos não são necessários no MVP. Produzir capa, livro aberto, verso e moldura de carta. Texto, nomes, valores e vencedores são conteúdo do aplicativo.

- Eventos comuns: pequenos efeitos no mapa.
- Cartas: revelar frente, mostrar efeito e fechar automaticamente se não houver decisão.
- Loja: painel de itens com preço e botão Passar.
- Início/prova/resultados/final: páginas do livro; vencedores de equipes têm todos os retratos, não só o primeiro.
- Decisões aguardam sem timeout; cenas decorativas podem ser puladas.

No código atual, `roundStarted` não recebe apresentação e o asset abertura não tem um disparador correspondente em scenesFor. Implementar gatilhos explícitos para início de jogo e rodada sem duplicar introduções.

### Ajustes de ritmo

- Pausa manual não chega ao componente de vídeo nem congela todas as animações CSS/SVG. Unificar pause/retomada visual.
- Passo rápido dura aproximadamente 189 ms, mas transição da peça está fixa em 350 ms. Usar duração compartilhada e aguardar apresentação visual sem reaplicar regras.
- Premiação emite uma cena pequena por participante antes da vitória; com dez jogadores isso cria uma fila longa. Consolidar distribuição numa página com todos os valores.
- Coordenador bloqueia pela cena atual, não pela fila pendente inteira. Proteger o intervalo entre cenas bloqueantes para evitar iniciar próximo comando antes de mostrar uma decisão/reação relevante.
- Manifesto referencia vídeos ausentes; remover tentativas de carregamento enquanto não existirem. Campo de áudio existe, mas ainda falta reprodução real.

## Documentação e preparação do evento

O plano inicial ainda descreve vídeos opcionais como etapa de aceite e detalhes de mapa que não estão na prévia. README diz que todos os valores podem ser alterados no setup, mas a interface expõe somente parte. Atualizar documentos depois das decisões de escopo para não instruir o próximo agente a reconstruir funcionalidades descartadas.

Criar um guia de uma página para o anfitrião: iniciar, pausar, resolver cartas físicas, registrar resultados, desfazer e recuperar backup. Uma origem fixa (mesmo host e porta) ajuda a manter acesso ao armazenamento local; exportar antes de mudar entre dev e preview.

Repositório público permite consultar e baixar código; não é automaticamente um site jogável. Uma demonstração hospedada é opcional para Arthur testar, separada da execução local prevista para a festa.

## Sequência recomendada

1. Corrigir undo, validação de estados e resultados. Acrescentar testes de regressão para os cenários acima.
2. Confirmar percurso final e formatos das provas; integrar cenário/personagens ao motor existente.
3. Implementar livro/cartas e controles compactos, com a fila e pausa corrigidas.
4. Simular economia e duração para 8, 9 e 10 jogadores. Medir compras de douradas, moedas acumuladas, frequência de decisões e tempo do tabuleiro; não balancear somente pela impressão.
5. Fazer ensaio de 45–60 minutos na TV: duas rodadas, duas provas curtas, loja, ataque/defesa, importação, recarga e final acelerado. Repetir somente o que falhar. Congelar regras e exportar backup antes do evento.

Critério de entrega: uma partida completa com a arte aprovada, decisões corretas e recuperação confiável. Não adicionar 3D, multiplayer, geração de vídeo em tempo real ou editor de mapas antes disso.
