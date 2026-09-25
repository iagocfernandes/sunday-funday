# Cartas da Milena, eventos e fotos — 24/09/2026

## Decisões implementadas

6 eventos de Sorte e 7 de Azar com os nomes da Milena. 6 poderes na loja, cada um por 10 moedas: Dado Duplo, Dado Certeiro, Troca-Troca, Muda a Banana!, Gorila Preguição e Gorila Blindado. Limite de 3 poderes e 1 ativo por turno. Troca-Troca preserva o adversário aleatório aprovado anteriormente.

Blindado automático, conforme resposta explícita do Iago: consome uma cópia ao bloquear um efeito prejudicial de Sorte/Azar contra seu portador. Não desperdiça proteção com benefícios e não protege contra poderes ou Iagugu.

## Convenções para teste

- Raras: uma cópia por ciclo; comuns: cinco. Sorte possui 18 entradas (3 raras + 3 comuns × 5); Azar possui 31 (1 rara + 6 comuns × 5). Sorteio persistido no servidor. Nomes/códigos antigos preservados para cartas já pendentes.
- Loteria transfere metade das moedas do alvo, arredondada para baixo. Não cria moedas.
- Pickpocket escolhe adversário e sorteia um poder. Com mão cheia, exige descarte de um poder antigo antes de entregar o novo. A transferência e o descarte não podem duplicar a carta.
- Tudo ou Nada escolhe oponente; anfitrião registra vencedor. Transfere o saldo inteiro do perdedor, mesmo que o vencedor tivesse menos moedas. Empate não transfere.
- Avançar/recuar 5 não ativa outras casas, paradas ou prêmio de volta. A bifurcação continua sendo uma escolha real.
- Teletransporte chega à árvore ativa, oferece compra por 20 se houver saldo e ainda não houver colheita no turno. Não oferece banana gratuita, prêmio de volta ou efeito de outra casa.
- Preguição limita o total da próxima rolagem a 1–3, inclusive se houver poder de dado. O efeito some após essa rolagem.
- Tarefas presenciais aparecem no celular; sua execução é presencial. Duração até início da próxima rodada, exceto Churrasqueiro (2 rodadas) e Fique Sóbrio para nome AR2 (2). Os textos mantêm as exceções pessoais da Milena.

Economia dos minigames, programação de provas e número de rodadas não foram alterados nesta entrega.

## Apresentação

Carta grande em fundo verde para Sorte e roxo para Azar. Nome, ícone do jogador, título e descrição. Revelação por 7 segundos controlada no servidor, seguida de aplicação automática ou escolha de alvo. O jogador não confirma um efeito obrigatório. Colheita também prossegue automaticamente. Pausa congela o avanço; ao retomar a carta, há tempo de leitura novamente.

Avisos de vez e uso de poder ocupam a tela brevemente. Ganhos/perdas simples mantêm aviso compacto. A arte de carta é uma composição provisória em CSS, pronta para futura substituição por ilustrações finais.

Câmera suave: deslocamento e zoom discretos sobre a imagem estática, acompanhando a posição do jogador. Desligável no Menu; preferência de movimento reduzido do sistema desativa o movimento.

## Fotos

Envio opcional na entrada. Corte central quadrado e JPEG de 128×128, até 14 mil caracteres (~10 KB), preparado no aparelho sem metadados originais. Servidor verifica formato, dimensões e tamanho; não aceita URLs externas ou SVG. Foto acompanha ícone do mapa e placar e permanece no estado da sala até expiração. Sem envio, mantém gorila padrão. Troca de foto durante a partida não faz parte desta entrega.

## Compatibilidade e verificação

Salas digitais já abertas recebem catálogo novo sem mudar o mapa, saldos ou poderes já na mão. Novas partidas continuam com 48 casas. Atualizar TV e celulares para carregar os textos e visuais novos.

206 testes e build passaram. Novos testes cobrem roubo, proteção, descarte, teletransporte, duelo com saldos diferentes, lentidão, tarefas, raridade, pausa e avanço automático, migração de catálogo e rejeição de fotos inválidas.

Integração local completou uma rodada real com dois jogadores (sala QA YR2X6B). Fluxo de foto testado no navegador, entrada e início via API real (sala QA E6VWDP): miniatura de 5.971 caracteres persistida como retrato do jogador. Inspeção visual de carta em 1366×768: output/evento-milena-tv.png. Verificação física em Safari/iPhone ainda depende do usuário.

Publicação: deployment dpl_BxeyhuXT3nifh2pAhP7U8gMxzzg9; alias https://sunday-funday-three.vercel.app/ confirmado com bundle index-CPHBRtS9.js.

Integração em produção passou na sala isolada GC4M57: catálogo Milena/Blindado, 48 casas, dois jogadores, autenticação, cliques concorrentes e duplicados, WebSocket, recarga de celular, rodada completa, resultado único e próxima rodada.
