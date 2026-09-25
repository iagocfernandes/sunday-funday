# Próxima rodada de execuções — 23/09/2026

Objetivo: levar o MVP atual a uma partida completa com a arte aprovada e recuperação confiável antes do evento de 27/09. Este documento planeja a execução; não registra funcionalidades futuras como concluídas.

## Ponto de retomada verificado

Histórico consultado: tarefa arquivada “Desenvolver jogo Sunday Funday”, especialmente a última análise do avanço no jogo. Conferência local em 23/09: 139 testes passaram em cinco arquivos; build passou. Não foi realizada uma partida pela interface nesta retomada.

- Desfazer vinculado ao gameId e classificação individual compartilhada entre motor e interface já estão implementados e cobertos por regressões.
- Validação de backups e fallback para snapshot anterior foram implementados parcialmente. `readKey` ainda chama `migrate` fora do catch; `migrate` atribui campos a `snapshot.state` sem garantir que seja objeto. Um estado primitivo pode lançar antes do fallback. O histórico já registrou reprodução desse problema.
- Alterações da rodada anterior permanecem locais, sem commit. Preservá-las e revisar o diff antes de acrescentar mudanças.
- Cenário e três personagens existem em `public/assets/`; `public/previa-tabuleiro.html` continua separado do `Board` funcional.
- Permanecem pendentes exclusividade entre abas, validação completa de equipes/resultados, opção de ladrão sem implementação e integração do livro.

## Execuções em ordem

### 1. Fechar confiabilidade — estimativa de 60–90 minutos

Corrigir a leitura/migração para que entrada malformada nunca impeça recuperar o snapshot anterior. Validar também envelope e controles persistidos, preservando tempo da janela e retomada manual. Cobrir state primitivo, estrutura inválida, versão incompatível, atual corrompido com anterior válido e ambos inválidos.

Corrigir posse do lock: verificar proprietário antes de comandos e gravações, pausar ao perder posse e renovar somente a sessão proprietária. Testar tomada de controle entre duas abas.

Validar equipes completas, não vazias, sem duplicatas, formato compatível com a prova e vencedor existente. Desabilitar a opção de ladrão enquanto não houver implementação.

Aceite: regressões passam; import inválido não altera save válido; aba anterior não escreve após perder posse; resultado inválido não altera moedas/revisão. Rodar `npm test` e `npm run build`.

### 2. Integrar cenário e personagens — estimativa de 90–150 minutos

Usar o Board real, com posições e movimentos provenientes do estado do jogo. Criar seleção de Arthur, Mari e Milena, com personagens genéricos para os demais; conferir os arquivos existentes antes de tratá-los como sprites finais. Não gerar novas artes automaticamente: preferência registrada é produzir no ChatGPT.

Preservar bifurcações como proposta padrão, pois estão no plano confirmado; não adotar silenciosamente o circuito único da prévia. Preparar percurso sobre o cenário para revisão visual antes de fixar novas coordenadas. Manter compatibilidade com mapas salvos e identificar a versão de novos mapas. A prévia deve consumir a mesma representação ou deixar de funcionar como segundo tabuleiro independente.

Aceite: dez peças identificáveis na casa inicial, destaque do jogador ativo, ordenação pelos pés, bifurcações clicáveis e percurso sem casas ilegíveis. Validar no navegador em 1920×1080 e na resolução real disponível; TV física fica para o ensaio.

### 3. Unificar livro, cartas e ritmo — estimativa de 90–150 minutos

Usar cenas estáticas no MVP: abertura, início de rodada, carta, prova, premiação coletiva e final. Remover referências a vídeos inexistentes e atualizar o plano antigo que ainda exige clipe. Mostrar todos os vencedores de equipe juntos.

Unificar duração de deslocamento e velocidade, propagar pausa visual e impedir avanço automático entre cenas bloqueantes ainda na fila. Eventos decorativos não alteram regras; decisões continuam sem timeout. A janela de item permanece em cinco segundos.

Aceite: pular cenas não muda saldos; pausa congela movimento/apresentação; premiação não gera dez avisos consecutivos; início e resultados não se repetem ao recarregar.

### 4. Preparar provas e economia — estimativa de 60–120 minutos, após definições

Permitir escolher prova e formato por rodada. Separar candidatos (Dixit, Jamboree, Time’s Up, tênis) de programação confirmada; beerpong está confirmado, mas seu formato precisa ser definido. Persistir rascunho de resultados ou avisar explicitamente que ele ainda não foi registrado.

Antes de fechar conteúdo: definir beerpong em duplas ou equipes, tratamento de nove participantes, quantidade de rodadas e desempate absoluto. Companheiro fica fora até ter regra aprovada. Preços e recompensas continuam identificados como propostas.

Simular partidas com 8, 9 e 10 jogadores e sementes reproduzíveis; registrar renda, compras de douradas e frequência de decisões. Simulação do motor não mede duração das provas físicas; medir ritmo visual no navegador e duração presencial no ensaio.

Aceite: todos participam, premiação visível corresponde ao formato escolhido e nenhuma modalidade provisória vira programação oficial automaticamente.

### 5. Ensaio e congelamento — 45–60 minutos de ensaio, mais correções encontradas

Completar duas rodadas com dez jogadores, incluindo bifurcação, loja, carta, ataque/defesa e premiação. Exercitar pausa, desfazer, recarga durante decisão e importação; acelerar o restante até o final. Repetir cenários específicos com oito e nove participantes.

Executar build local com rede desligada, mesma origem/porta e TV real. Conferir controles, legibilidade e backup baixado. Preparar guia de uma página do anfitrião e atualizar README/estado das pendências. Revisar e registrar alterações em commits por entrega; publicação não é necessária para operar a festa.

Aceite: partida termina sem console ou edição de arquivos, recarga não rerola nem duplica prêmios, backup restaura saldos e decisões. Testes e build verdes complementam, mas não substituem, esse ensaio.

## Ordem de corte se o prazo apertar

Manter recuperação, regras corretas, tabuleiro funcional, resultados e ensaio. Reduzir variedade de cenas, usar retratos genéricos e repetir provas aprovadas antes de acrescentar artes ou mecânicas. Não incluir ladrão, companheiro, 3D, multiplayer ou vídeos nesta rodada.

## Primeira execução pronta

> Execute somente a etapa 1 deste documento. Preserve as alterações locais existentes. Comece reproduzindo a exceção de leitura/migração do snapshot e acrescente regressão que prove a recuperação do anterior. Depois corrija exclusividade entre abas, validação de equipes/resultados e desabilite o ladrão não implementado. Não altere regras, mapa ou artes. Rode testes e build; informe resultados e limitações. Não publique nem faça push.
