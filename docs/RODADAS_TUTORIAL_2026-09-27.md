# Rodadas, tutorial e economia — 27/09/2026

Implementado localmente com subagentes. Não publicado. Novas partidas usam
`minigameRulesVersion: 2`; partidas já salvas mantêm sua sequência e premiação.

## Sequência de 10 rodadas

| Rodada | Prova | Prêmio por vencedor |
|---|---|---|
| 1 | Beer Pong | 10 moedas |
| 2 | Jamboree em duplas | 10 moedas |
| 3 | Time's Up em dois grupos | 10 moedas |
| 4 | Tênis — Switch Sports | 10 moedas |
| 5 | Coup individual | 20 moedas |
| 6 | Jamboree em duplas | 10 moedas |
| 7 | Beer Pong | 10 moedas |
| 8 | Time's Up em dois grupos | 10 moedas |
| 9 | Tênis — Switch Sports | 10 moedas |
| 10 | Coup — final individual | 1 banana dourada, zero moedas |

O usuário informou sete participantes. As duplas são sorteadas presencialmente:
o anfitrião registra apenas os vencedores. Provas de dupla aceitam uma dupla
vencedora ou um solo quando o total de participantes é ímpar. Time's Up aceita
os integrantes do grupo vencedor. Perdedores recebem zero.

Coup: sete participantes jogam todos. Acima de sete, o motor sorteia e persiste
o excedente antes da prova; esses jogadores recebem dez moedas ao registrar o
resultado e não podem ser selecionados como vencedores. Confirmar duas vezes
não duplica o prêmio.

Final: os sete participantes jogam Coup individual. Registre um único campeão;
ele recebe uma banana dourada e zero moedas. O sistema soma a banana antes da
classificação final.

## Tutorial e duelo

Abertura gravada → tutorial em quatro telas → primeira rodada. O anfitrião
pode avançar, voltar, pular ou rever pelo menu. O servidor bloqueia ações dos
celulares e o avanço automático durante o tutorial; recargas preservam o passo.
Rever preserva pausa e cronômetros. Partidas antigas não abrem automaticamente.

Duelo: Beer Pong individual, três copos por lado, tentativas alternadas com
direito ao mesmo número de arremessos. Se ambos completarem juntos, copo extra
até desempatar. Mantida a aposta transferida do perdedor ao vencedor, sem
recompensa adicional. TUDO OU NADA mantém seu efeito existente.

## Preços trazidos do GitHub

Fonte: [ec0fa96](https://github.com/iagocfernandes/sunday-funday/commit/ec0fa96c4fd252b70c728280bbcefd255d3d8d04), integrado no PR #1 / merge ae502e1.
Somente preços foram incorporados, preservando efeitos.

| Poder da loja atual | Moedas |
|---|---|
| Gorila Blindado | 3 |
| Muda a Banana! | 4 |
| Gorila Preguição | 5 |
| Dado Duplo | 6 |
| Dado Certeiro | 8 |
| Troca-Troca | 8 |

Catálogo legado também sincronizado: Banana Turbo 4, Mão no Bolso 6, Escudo 3,
Casca 2, Reverse 4. Não foi importado o restante do merge remoto.

## Verificação

Prévia isolada `/design/?tab=rounds`, com sete ou dez participantes, seleção da
rodada, aplicação real de premiação pelo motor e tutorial. Validação visual de
solo no tênis, banana da final e excluídos do Coup. Testes cobrem permissões,
duplicação, participantes inválidos, legado, pausa e recuperação.
