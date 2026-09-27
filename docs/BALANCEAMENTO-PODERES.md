# Balanceamento dos poderes — 26/09/2026

A festa é em 27/09. Esta passagem mexe só em preço. Efeito, mapa, dado, rodadas e telas continuam os mesmos. O texto da loja, do Iagugu e da Milena passa a mostrar o número que o código cobra.

A banana dourada continua a 20 moedas. Ela é o ponto da vitória. Subir esse preço na véspera encurtaria a corrida e alongaria a partida. O equilíbrio pedido é entre os poderes: nenhum compra a vitória sozinho, nenhum é taxa disfarçada.

## Método

O motor usado é o de produção (`createGame`, `applyCommand`, `ranking`, `winnersOf`), mapa `ilha-dos-gorilas-v5`, 8 rodadas, dado 1–10, 10 moedas iniciais, cartas digitais da Milena. O script está em `scripts/balance-powers.ts`.

Política igual para todos os bots:

- caminho mais curto até a árvore da banana ativa;
- compra a banana sempre que ela aparece e há saldo;
- na medição de valor, a loja não compra nada, para o item concedido ser a única diferença;
- na medição de frequência, a loja compra um poder aleatório se sobrarem pelo menos 8 moedas e o inventário tiver menos de 3, e em 35% das bifurcações o bot pega o segundo caminho mais curto (senão o Iagugu, que fica fora da rota da banana, nunca é visitado);
- usa Dado Duplo e Dado Certeiro quando a banana está a mais de um passo; Troca-Troca só se estiver mais de dois passos atrás; Muda a Banana se um rival está estritamente mais perto; Preguição e Casca sempre que dá;
- Iagugu rouba banana se tiver o preço e a vítima tiver banana; senão rouba moedas de quem tem mais;
- duelo aposta o mínimo entre 3 e o máximo, vencedor 50/50;
- prova: ranking aleatório.

Sementes pareadas: partida `i` usa `10001 + i * 7919`, com a mesma ordem sorteada no controle e no tratamento. O herói medido é sempre `p0`.

Vantagem medida: diferença da taxa de vitória de `p0`, em pontos percentuais, quando ele começa com o poder de graça. Vantagem por moeda: essa diferença dividida pelo preço. Residual: a mesma diferença quando o preço é debitado do saldo inicial.

Amostra da tabela principal: 200 partidas por célula, 8 jogadores. O erro padrão de uma diferença de taxa de vitória fica em torno de 3 pontos percentuais. Diferença menor que isso é ruído. No total o motor rodou cerca de 10 mil partidas (catálogo, preços candidatos, âncora da banana e checagem com 2, 4 e 10 jogadores).

A checagem com 2, 4 e 10 jogadores usou 80 partidas por célula. Quase todas as diferenças caíram dentro do ruído. A tabela abaixo está calibrada para 8 jogadores, o tamanho esperado da mesa. Uma exceção aparece no risco da festa: em dupla, Muda a Banana mediu forte.

O que a simulação não viu fica marcado como estimativa. Não há número inventado no lugar de uma corrida.

## Catálogo, efeito e frequência

Frequência abaixo é a média por partida na política que compra e explora, 8 jogadores, 200 partidas. Os bots escolhem o poder aleatório entre os que cabem no bolso, então a compra parecida não é preferência humana: é acesso.

| Poder | Onde | Custo antes | Efeito | Compra / uso por partida |
|---|---|---:|---|---|
| Dado Duplo | Loja | 5 | Dois dados, anda a soma (média 11) | 1,39 / 1,07 |
| Dado Certeiro | Loja | 5 | Escolhe a face de 1 a 10 | 1,51 / 1,16 |
| Troca-Troca | Loja | 5 | Troca de casa com um adversário aleatório e depois rola | 1,53 / 1,15 |
| Muda a Banana! | Loja | 5 | O pedestal vai para outra árvore do Fábio | 1,47 / 1,12 |
| Gorila Preguição | Loja | 5 | A próxima rolagem do alvo fica entre 1 e 3 | 1,55 / 1,19 |
| Gorila Blindado | Loja | 5 | Anula um azar ou um roubo de carta contra você. Passivo | 1,48 / — |
| Banana dourada | Árvore | 20 | +1 banana. Desempate é moeda; vitória é banana | ~3,9 compras na mesa que explora |
| Iagugu, moedas | Parada | 0 | Transfere até 10 moedas. Não cria saldo | 4,33 visitas; ~39 moedas transferidas |
| Iagugu, banana | Parada | 40 | Paga e transfere 1 banana. Não cria fruto | 0,42 transferências quando o bot explora |
| Banana Turbo | Fora da loja atual | 5 | Soma 5 ao dado deste turno | Não está na loja da ilha nova |
| Mão no Bolso | Fora da loja atual | 8 | Rouba um poder aleatório de um adversário | Não está na loja da ilha nova |
| Casca de banana | Loja do mapa antigo | 4 | O alvo perde até 3 moedas. Quem usa não recebe | Não está na loja da ilha nova |
| Escudo | Loja do mapa antigo | 5 | Bloqueia um ataque do catálogo antigo | Não está na loja da ilha nova |
| Reverse | Loja do mapa antigo | 6 | Devolve um ataque do catálogo antigo | Não está na loja da ilha nova |

Cartas da Milena não têm preço. O efeito não foi alterado. Na mesma amostra, as comuns de Sorte saíram ~3,8–3,9 vezes por partida e as raras (peso 1) ~0,75–0,81. As comuns de Azar saíram ~2,1–2,3 e a rara MA07 ~0,44. Isso acompanha o peso 5 contra 1. O teletransporte continua oferecendo a banana por 20, o mesmo `goldenPrice`.

## O que a corrida mediu

Controle, 8 jogadores, loja fechada, 200 partidas: `p0` vence 9%, posição média 4,6, 0,64 bananas, 37,8 moedas no fim.

Conceder o poder de graça no início (diferença contra esse controle):

| Poder | Vitória | Posição (positivo = melhor) | Bananas | Moedas | Moedas equivalentes (20 × bananas + moedas) |
|---|---:|---:|---:|---:|---:|
| Banana de graça | +17 pp | +1,21 | +0,51 | −2,5 | +7,6 |
| Dado Duplo | +6 pp | +0,24 | +0,01 | +2,7 | +2,9 |
| Dado Certeiro | +6,5 pp | +0,45 | +0,09 | +1,0 | +2,7 |
| Troca-Troca | +5 pp | +0,30 | +0,05 | +2,5 | +3,4 |
| Preguição | +4,5 pp | +0,37 | +0,06 | +1,7 | +2,8 |
| Muda a Banana | +3 pp | +0,31 | −0,04 | +4,2 | +3,5 |
| Blindado | 0 pp | +0,09 | +0,02 | +0,8 | +1,2 |
| Banana Turbo | +2 pp | +0,27 | +0,07 | −0,9 | +0,5 |
| Casca | 0 pp | −0,13 | −0,02 | −1,1 | −1,5 |

Pagando o preço antigo de 5, ainda no saldo inicial de 10:

| Poder | Vitória residual |
|---|---:|
| Dado Duplo | +2,5 pp |
| Dado Certeiro | +5 pp |
| Troca-Troca | +5 pp |
| Muda a Banana | +0,5 pp |
| Preguição | −1 pp |
| Blindado | 0 pp |

Candidatos, mesma regra:

| Preço testado | Vitória residual |
|---|---:|
| Dado Duplo a 6 | +2,5 pp |
| Dado Duplo a 8 | +1 pp, posição pior |
| Dado Certeiro a 7 | +4,5 pp |
| Dado Certeiro a 8 | +4 pp |
| Troca-Troca a 8 | +4,5 pp |
| Troca-Troca a 10 | +5 pp |
| Preguição a 4 | −0,5 pp |
| Muda a Banana a 4 | +1 pp |
| Blindado a 3 | +0,5 pp |

Âncora com bolsa de 60 moedas no herói, para o pagamento não zerar o saldo (10 moedas iniciais faziam “pagar 20” e “pagar 40” caírem no mesmo zero). 200 partidas, 8 jogadores. Aqui o controle já vence 24%, porque só o herói começa rico. A diferença é o que importa.

| Situação | Vitória contra esse controle |
|---|---:|
| Comprar uma banana pagando 20 | +16 pp |
| Rival já começa com uma banana | 0 pp |
| Ganhar uma banana pagando 30 | +12,5 pp |
| Ganhar uma banana pagando 40 | +8 pp |
| Ganhar uma banana pagando 50 | +2 pp |

Essa âncora mede quem ganha o fruto e paga. Não mede, na mesma célula, o rival perdendo um fruto que já tinha. A linha “rival já começa com uma banana” é essa outra metade: em 8 jogadores ela não move a vitória de `p0` para fora do ruído. O prejuízo de uma vítima entre sete quase não decide o campeão. O que decide é ter a banana.

### Estimativas, onde o bot não acionou o efeito

Escudo, Reverse e Mão no Bolso, concedidos de graça, produziram a mesma linha (+4 pp, as mesmas moedas). Com a loja fechada ninguém segura item para ser roubado, e Escudo/Reverse só reagem ao ataque antigo (Casca), que os bots da ilha nova não compram. Os +4 pp são o ruído da semente, não o poder. Preço novo por leitura do efeito:

- Escudo: mesmo papel de “anula um golpe”, no catálogo antigo. Fica 3, ao lado do Blindado.
- Reverse: devolve o golpe em vez de só anular. Fica 4.
- Mão no Bolso: vale um poder aleatório da loja nova, e só se a vítima tiver um. A mediana da loja nova é 5,5. Fica 6. Antes custava 8, o preço dos melhores dados, por um roubo incerto.
- Casca: você paga para apagar até 3 moedas de outra pessoa e não fica com elas. A 4 era um mau negócio. Fica 2. A corrida, com o item de graça, não mostrou vitória.
- Blindado: a corrida de 8 jogadores não moveu a vitória (0 pp de graça). Parte do Azar é tarefa presencial, que o escudo não cobre. O valor mecânico cabe numa carta prejudicial ocasional. A 5 ele empatava com o dado e era armadilha. Fica 3, seguro barato. O residual a 3 foi +0,5 pp.
- Banana Turbo soma 5 a um dado de média 5,5. O Duplo sobe a média para 11. A corrida deu só +2 pp ao Turbo, dentro do ruído, contra +6 pp do Duplo. Fica 4, abaixo do Duplo. Não entra na loja da festa.

## Tabela antes e depois

Vantagem por moeda = pontos percentuais de vitória do item grátis ÷ preço. Meta da loja: ficar entre cerca de 0,6 e 1,0, com o Blindado de propósito mais barato porque a vitória medida foi zero. Residual é o que sobra depois de pagar, na amostra de 8 jogadores.

| Poder | Custo antes | Vantagem (pp) | Por moeda antes | Custo depois | Por moeda depois | Residual no preço novo |
|---|---:|---:|---:|---:|---:|---|
| Dado Duplo | 5 | +6 | 1,20 | 6 | 1,00 | +2,5 pp a 6 |
| Dado Certeiro | 5 | +6,5 | 1,30 | 8 | 0,81 | +4 pp a 8 |
| Troca-Troca | 5 | +5 | 1,00 | 8 | 0,63 | +4,5 pp a 8 |
| Muda a Banana! | 5 | +3 | 0,60 | 4 | 0,75 | +1 pp a 4 |
| Gorila Preguição | 5 | +4,5 | 0,90 | 5 | 0,90 | −1 pp a 5; −0,5 pp a 4 |
| Gorila Blindado | 5 | 0 | 0 | 3 | 0 na vitória | +0,5 pp a 3 |
| Banana dourada | 20 | +17 de graça | 0,85 | 20 | 0,85 | +16 pp pagando 20, com bolsa de 60 |
| Iagugu, banana | 40 | ganhar o fruto | — | 50 | — | +8 pp a 40; +2 pp a 50 |
| Iagugu, moedas | 0 | transferência, fora da rota | — | 0 | — | continua grátis |
| Banana Turbo | 5 | +2 (ruído) | — | 4 | estimativa | fora da loja |
| Mão no Bolso | 8 | efeito não disparou | — | 6 | estimativa | fora da loja |
| Casca | 4 | 0 | — | 2 | estimativa | mapa antigo |
| Escudo | 5 | efeito não disparou | — | 3 | estimativa | mapa antigo |
| Reverse | 6 | efeito não disparou | — | 4 | estimativa | mapa antigo |

Preguição permanece 5. A 4 ou a 5 o residual fica em torno de zero. Baixar para 4 deixaria a melhor vantagem por moeda da loja num efeito que a corrida não separou do ruído com folga.

Dado Certeiro e Troca-Troca param em 8, não em 10. A 10 o Troca-Troca ainda media +5 pp, porque gastar as 10 moedas iniciais e gastar 8 deixam o herói igualmente sem banana cedo, e 5 pp contra 4,5 pp cabe no erro de 3 pp. Cobrar 10 esvaziaria a primeira loja. 8 já separa esses dois do Duplo (6) e do Blindado (3), e ainda cabe no bolso inicial.

## O que estava torto

Os seis poderes da loja custavam 5. A frequência de compra era parecida porque o bot compra no escuro. O valor não era.

Dado Certeiro e Troca-Troca continuavam com cerca de +5 pp depois de pagar 5. Eram os dominantes: um passo escolhido ou uma troca de casa vale uma fatia grande da corrida até a árvore, e 5 moedas não cobram isso.

Dado Duplo a 5 já ficava perto do justo (+2,5 pp). Subiu para 6 para não continuar no mesmo patamar dos fracos. A 8 a posição piorou: o dado extra deixa de compensar o bolso.

Muda a Banana e Preguição, a 5, não compravam vitória. Muda desce para 4, onde o residual foi +1 pp. Preguição fica em 5.

Blindado a 5 empatava com o dado e a corrida não viu vitória. Era a compra inútil. A 3 ele volta a ser um seguro, não uma taxa.

Iagugu a 40, com saldo bastante para o pagamento existir, ainda dava +8 pp por ganhar uma banana fora da árvore. A 50 o residual cai para +2 pp. O documento de regras de 24/09 já pedia 50. O código e as duas telas diziam 40. Agora os três dizem 50. O roubo de até 10 moedas continua grátis: é desvio de rota, transfere saldo em vez de criar banana, e a mesa já aprendeu “moedas de graça”.

A frase da Milena que dizia “cada um por 10 moedas” não batia com o código, que cobrava 5. Os dois foram alinhados à tabela nova. Os efeitos das cartas não mudaram.

## Riscos para a festa

- Os bots não são a mesa. Eles não guardam o Certeiro para o último trecho nem combinam Troca-Troca. Se amanhã esses dois ainda parecerem obrigatórios, o sintoma esperado é o residual de +4 pp, não um bug. Não retocar no meio da festa.
- Em dupla, numa amostra curta de 80 partidas, Muda a Banana deu +21 pp de graça. Com 8 jogadores foi +3 pp. Se a mesa for de dois, essa carta está barata. Para o grupo, 4 é o preço que a corrida grande sustenta.
- Blindado pode parecer fraco se as cartas que saírem forem as tarefas presenciais. O preço baixo é de propósito.
- Dado Certeiro e Troca-Troca a 8 gastam quase as 10 moedas do começo. A primeira loja vira uma escolha de verdade: o poder ou a reserva da banana. Era isso que o preço único de 5 não fazia.
- Iagugu passa de 40 para 50 na banana. Falar o número em voz alta uma vez. As moedas seguem de graça.
- A banana segue a 20. A partida continua curta e decidida pelo fruto, não por quem empilhou poder.
