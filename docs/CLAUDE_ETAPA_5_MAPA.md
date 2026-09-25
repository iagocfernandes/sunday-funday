> Catálogo atualizado: [Cartas da Milena, eventos automáticos e fotos](CARTAS_MILENA_EVENTOS_E_FOTOS_2026-09-24.md). Blindado é automático; não pedir confirmação de eventos sem escolha.

> Atualização posterior: a interface da TV/celular foi redesenhada e partidas novas usam 48 casas (v5). Consulte [Interface e 48 casas](INTERFACE_E_48_CASAS_2026-09-24.md). Salas anteriores preservam 36 casas.

> ATUALIZAÇÃO DE EXECUÇÃO: versão v4 implementada e publicada para o teste de almoço, conforme pedido posterior do usuário. Leia primeiro `docs/TESTE_ALMOCO_2026-09-24.md`. O ensaio amplo, balanceamento de 8–10 jogadores e catálogo final de Sorte/Azar continuam pendentes; notas abaixo sobre não implementação/publicação são históricas.

> NOVA BASE DE REGRAS: ler primeiro `docs/REGRAS_CONSOLIDADAS_2026-09-24.md`. Foram acordados +10 por volta, Iagugu (moedas grátis / banana por 50), três casas de Duelo e remoção de neutras. Essas mudanças ainda não estão implementadas; não considerar a versão anterior completa para publicação. A arte de 11:27 foi aprovada, mas ainda precisa ser integrada. O restante deste roteiro deve ser atualizado conforme essa base.

> Atualização de direção visual: o usuário pediu refazer o mapa após esta entrega. Leia `docs/REDESENHO_MAPA_V4.md`. O mapa v3 continua no código, mas sua arte não é a versão visual final; a nova planta ainda está em revisão. Os testes de regras continuam úteis. Coordenar a publicação com a integração do novo visual, sem apresentar o v3 como redesenho aprovado.

# Claude — etapa 5: validar e publicar o mapa v3

## Prompt para execução

Trabalhe no projeto `/Users/iagoamorim/Projects/sunday-funday`. As etapas 1–4 do plano `docs/PLANO_MAPA_LOJAS_ARVORES.md` foram implementadas localmente pelo Codex: mapa v3, serviços entre casas, decisões no celular e composição visual com árvores. Sua responsabilidade é a etapa 5: revisão independente, correções necessárias, ensaio completo, economia e publicação. Não recrie essas etapas do zero e preserve as alterações existentes (há muito trabalho ainda sem commit). Leia AGENTS.md e as instruções aplicáveis antes de começar.

### 1. Confira a implementação e as regras

- Novas partidas usam `ilha-dos-gorilas-v3`, schema 4, 36 casas, duas bifurcações, duas lojas e quatro árvores. A bifurcação leste saiu de m17 para m16. m6, m14 e m18 viraram casas neutras; os antigos serviços dessas casas saíram do percurso v3. Saves antigos preservam mapa/regras antigos.
- Serviços são paradas em arestas dirigidas: `shop-west` m2→m3, `shop-east` m17→m18, `tree-temple` m9→m10, `tree-waterfall` m13→m14, `tree-bridge` m22→m23, `tree-glade` b0→b1. Parar não consome passo; chegar à próxima casa consome exatamente um.
- Colheita custa 20 moedas, no máximo uma por turno. Uma das outras três árvores recebe o fruto; o jogador confirma a apresentação no celular antes de continuar. Recuos e trocas não ativam lojas/árvores.
- Seis poderes: Dado Duplo soma dois dados; Dado Certeiro escolhe 1–10; Banana Turbo +5; Troca-Troca escolhe adversário aleatório; Mão no Bolso escolhe adversário, mas o poder roubado é aleatório; Muda a Banana sorteia outra árvore. Máximo de três poderes, quarto exige descarte e compra atômicos.
- Preços são provisórios: 5,12,5,5,8,5 respectivamente. Sorte/Azar digitais usam por enquanto um catálogo mínimo de seis eventos: +5, +3, Mão Leve (rouba até 5 moedas), −3, recua 3, −5. Não tratar preços ou variedade como balanceamento aprovado.
- Todos os comandos do jogador exigem identidade, pendência correspondente, revisão e partida corretas. Anfitrião mantém alternativa administrativa. Sorteio e baralhos futuros ficam privados no servidor. Rodadas/provas transitam automaticamente; resultados presenciais continuam com o anfitrião.

### 2. Revise e teste, corrigindo problemas encontrados

Execute `npm test` e `npm run build`. Na entrega do Codex passaram 176 testes. Revise especialmente engine, persistência, `server/room.ts`, `server/board.ts`, DecisionPanel e BoardRemote. Os testes antigos usam mapa legado intencionalmente; `src/game/stops.test.ts` cobre as novas regras.

Cubra todas as paradas, bifurcação antes de parada, último passo, zero passos, recusa, saldo insuficiente, inventário cheio, cancelar descarte, compra confirmada, cliques concorrentes/repetidos, reconexão durante pendência, pausa/retomada, duas árvores no mesmo turno, fruto nascendo ao lado de jogador parado, movimento forçado, seis poderes, eventos digitais e restauração de saves antigos. Verifique que nenhum jogador age pelo outro ou envia comandos administrativos.

Faça o ensaio remoto com TV e pelo menos dois clientes independentes. Os testes visuais do Codex usaram fixtures locais, não substituem esse ensaio. Percorra uma rodada completa sem tocar no computador, exceto para registrar o resultado da prova. Comprove escolha de caminho, compra/descarte, colheita, nova árvore e fim do deslocamento. Teste apresentação na TV 1920×1080, celular estreito, dez peças juntas, reconexão e acessibilidade do botão de ajuda do anfitrião. Confira que a apresentação na TV permanece tempo suficiente para leitura e não encobre decisões.

`scripts/check-board.mjs` é um roteiro antigo de integração, agora reconhece novas pendências, mas ainda resolve decisões pelo anfitrião. Adapte-o para exercitar o responsável no celular e tolerar as transições automáticas entre rodada/prova. Não confunda executar esse roteiro com comprovar o fluxo completo novo.

### 3. Verifique rotas, ritmo e economia

Calcule acessibilidade/distâncias dos dois caminhos até lojas e árvores. Documente se há rota sempre dominante e corrija apenas com justificativa. Simule partidas de 8, 9 e 10 jogadores com o mapa/poderes novos, explicitando número de rodadas, política de compras e uso de poderes. Informe média e faixas de bananas por jogador e total, saldos e duração esperada. As estimativas anteriores em `docs/ESTIMATIVA_BANANAS_2026-09-23.json` não valem para a nova economia. Atualize/adapte o simulador, sem fabricar números.

Teste carga de 10 celulares mais TV, chamadas ao Redis e reconexões; evite consumo desnecessário no plano gratuito. Não imprima tokens ou segredos de `.env.local`.

### 4. Publique somente após validação

Use o projeto Vercel existente. Verifique compatibilidade dos imports ESM das funções e banco, preserve salas antigas e crie uma sala NOVA para verificar o mapa v3. Já houve divergência entre deployment mais recente e alias público; confirme a versão realmente servida em `https://sunday-funday-three.vercel.app/`, não só o sucesso do build. Não considere esta entrega local já publicada.

Se houver falha impeditiva, corrija e repita os checks afetados antes de publicar. Ao concluir, entregue: problemas corrigidos, evidência dos testes/ensaio, estimativa econômica com premissas, URL/deployment verificados e limitações restantes. Arte está implementada como cenário existente + caminhos/serviços + árvore transparente (`public/assets/board/arvore-fabi-v1.png`); avaliação estética final do usuário ainda pode gerar ajustes. Impressão permanece opcional e não limita o estoque digital.
