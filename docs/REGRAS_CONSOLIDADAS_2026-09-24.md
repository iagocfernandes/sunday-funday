> ATUALIZAÇÃO DE EXECUÇÃO: versão v4 implementada e publicada para o teste de almoço, conforme pedido posterior do usuário. Leia primeiro `docs/TESTE_ALMOCO_2026-09-24.md`. O ensaio amplo, balanceamento de 8–10 jogadores e catálogo final de Sorte/Azar continuam pendentes; notas abaixo sobre não implementação/publicação são históricas.

# Gorilas — regras consolidadas e próxima execução

Atualizado em 24/09/2026 após aprovação do bônus de volta e preços do Iagugu. Este documento prevalece sobre propostas anteriores conflitantes. Consolidação de decisões; as mudanças abaixo ainda não foram implementadas nesta rodada.

## 1. Tabuleiro e direção visual

36 casas no conjunto, circuito principal com dois caminhos alternativos. Zero casas exclusivamente neutras. Distribuição acordada: 1 Início, 10 casas +3 moedas, 6 casas −3 moedas, 8 Sorte, 8 Azar, 3 Duelo. As cinco neutras anteriores dão lugar a três Duelo, uma Sorte e uma Azar. Efeitos normais das casas acontecem ao terminar o movimento, não a cada passagem.

Duas lojas, quatro árvores do Fabi (uma ativa) e uma parada do Iagugu ficam entre casas, sem gastar passos. Iagugu em uma das rotas após uma bifurcação, tornando a visita uma escolha. Localização exata e redistribuição de efeitos serão fechadas na planta antes da implementação.

Arte aprovada pelo usuário: `/Users/iagoamorim/Downloads/Imagem Codex 24_09_2026, 11_27_12.png`. Fantasia tropical com materiais realistas e formas estilizadas; árvores com rosto integrado ao tronco. Preservar a arte aprovada, acrescentando o Iagugu de maneira integrada e mantendo as trilhas legíveis. A imagem ainda não está integrada ao jogo. Referência de percurso: `docs/REDESENHO_MAPA_V4.md` e `output/mapa-v4/planta-percurso.png`.

## 2. Economia e serviços

- Ao completar uma volta e passar pelo Início: +10 moedas. A chegada inicial da partida não conta como volta. Ao terminar exatamente no Início, considerar a chegada uma única passagem, sem duplicar o bônus. Para implementação propõe-se restringir a movimento normal para a frente; recuo, troca e teleporte não pagam bônus. Esse detalhe operacional ainda deve ser confirmado.
- Casas positivas: +3 moedas; negativas: perde até 3, sem saldo negativo.
- Colher banana dourada: 20 moedas, no máximo uma colheita por turno. O fruto muda para uma das outras três árvores; o jogador confirma no celular antes de continuar. Árvores inativas não interrompem.
- Iagugu: roubar moedas é gratuito; roubar uma banana dourada custa 50 moedas. Jogador escolhe a vítima. Banana roubada é transferida, não criada. Quantidade de moedas roubadas ainda não definida. Não importar automaticamente outras regras do Jamboree.
- Proposta operacional do Iagugu: uma ação por visita, opção de passar, vítima diferente do visitante e saldo/banana suficientes para o roubo. Falta fechar quantidade fixa versus sorteada de moedas e se há algum limite adicional por turno para roubo de banana (a regra de uma colheita por turno não define isso).

Configuração atual do código, não revalidada pelo balanceamento novo: 10 moedas iniciais, oito rodadas, dado de 1–10; provas individuais pagam 10/6/3 moedas e equipes 8/3 (empate 5). Preservar como base de simulação, sem tratar como novo acordo de equivalência ao Jamboree.

## 3. Duelos

Três casas de Duelo; ativam somente ao terminar o movimento sobre elas. Sorteio de adversário entre os outros jogadores com moedas; após revelar o adversário, o jogador da vez escolhe o valor no celular. Aposta limitada ao menor saldo dos dois. Vencedor ganha o valor da aposta do perdedor; empate sem transferência. Exemplo: aposta 5, vencedor +5 e perdedor −5.

Duelo presencial, resultado registrado pelo administrador. Turno fica suspenso até a resolução; após resolver, segue seu encerramento, sem consumir rodada extra ou substituir automaticamente a prova normal da rodada. Definir catálogo de provas rápidas e sua seleção. Falta decidir o comportamento quando visitante ou todos os adversários estão sem moedas; não deixar uma pendência impossível.

## 4. Poderes, Sorte/Azar e controles

Poderes provisórios mantidos: Dado Duplo (soma dois dados); Dado Certeiro (escolhe 1–10); Banana Turbo (+5 ao dado); Troca-Troca (adversário aleatório); Mão no Bolso (adversário escolhido, poder roubado aleatório); Muda a Banana (outra árvore aleatória). Inventário máximo três poderes; quarto exige descarte antes de cobrar/entregar. Nomes e preços das cartas ainda podem mudar.

Sorte/Azar são eventos digitais separados, sem impressão obrigatória. Milena está elaborando os efeitos em paralelo. O baralho mínimo atualmente no código é provisório, não o catálogo final. Mão Leve é evento de Sorte, não poder de loja. Preparar a integração e aguardar a lista da Milena antes de fechar os efeitos.

Celular: dado, caminho, poder, alvo, compras, aposta e confirmações. TV: mapa, movimentos, eventos e resultado das decisões. Computador: registro dos resultados das provas/duelos presenciais e ajuda administrativa quando necessária. Impressão de poderes/bananas é opcional e não limita estoque digital.

## 5. Próximas entregas, em ordem

1. Atualizar planta sobre a arte aprovada: posicionar 36 casas, três duelos distribuídos, duas lojas/quatro árvores e Iagugu em uma rota. Acrescentar indicação clara de +10 no Início. Separar posição visual da construção/personagem e ponto de interação. Comparar distâncias e incentivos das rotas; evitar concentrar todos os atrativos no mesmo caminho.
2. Implementar regras no motor com versão de mapa/save compatível: bônus de volta, Iagugu, três casas de Duelo e nova distribuição. Persistir pendências, aposta e resultado; validar alvos/saldos no servidor, impedir pagamentos/resultados duplicados e preservar partidas antigas. Regras de quantidade roubada e sem-moedas devem ser fechadas antes das respectivas implementações.
3. Completar controles de celular e apresentação na TV: escolha de roubo/vítima, aposta, espera do duelo e registro administrativo. TV mostra +10 ao passar pelo Início; manter decisões sincronizadas durante pausa e reconexão.
4. Integrar a arte aprovada e os eventos da Milena, assim que entregues. Não redesenhar o cenário inteiro sem necessidade; novos indicadores e banana ativa ficam em camadas dinâmicas. Conferir dez jogadores, legibilidade e nenhuma sobreposição de casas com árvores/lojas.
5. Claude: revisão independente, testes remotos completos, simulação de 8–10 jogadores e publicação validada. Reavaliar ritmo, emissão de moedas, disponibilidade de roubos de 50 e bananas transferidas versus criadas. Documento de handoff: `docs/CLAUDE_ETAPA_5_MAPA.md`.

## Definições ainda abertas

Quantidade/aleatoriedade de moedas roubadas pelo Iagugu; frequência permitida de roubo; regra de Duelo sem moedas; provas dos duelos; confirmação da regra de volta para movimento forçado. Preços de poderes, distribuição final no mapa e conteúdo de Sorte/Azar ainda sujeitos à conclusão e balanceamento.
