# Plano de execução — tabuleiro na TV e controles no celular

## Objetivo e situação confirmada

Integrar o protótipo remoto ao motor existente, permitindo que 2–10 jogadores rolem no celular e acompanhem movimento, efeitos e placar na TV. Primeiro entregar uma partida remota operável pelo anfitrião; depois transferir decisões aos celulares.

O usuário e Emiliano testaram em aparelhos reais: entraram na sala, rolaram e registraram jogadas. O protótipo está em https://sunday-funday-three.vercel.app/?remote=tv . Usa Vercel Functions, WebSocket e Upstash Redis gratuito, com upgrade automático desligado. A última verificação registrada teve 149 testes aprovados e build aprovado; refazer a linha de base antes de editar, pois há trabalho local sem commit.

Este plano atualiza a orientação antiga de não incluir multiplayer em `docs/PROXIMA_RODADA_2026-09-23.md`. Não incorpora automaticamente as outras entregas daquele documento. Design e materiais físicos continuam em outra frente.

## Leitura inicial e limites

1. Ler instruções locais e revisar `git status`/diff. Preservar todo trabalho existente; não resetar, limpar ou sobrescrever alterações de outra frente.
2. Ler `docs/TESTE_CONTROLES_CELULAR.md`, `server/room.ts`, `server/store.ts`, `server/http.ts`, `server/socket.ts`, `src/remote/*`, `src/game/engine.ts`, `src/game/types.ts`, `src/automation/useGameSession.ts` e `src/screens/GameScreen.tsx`.
3. Executar `npm test` e `npm run build`; separar falhas preexistentes das introduzidas.
4. Preservar a rota local e os saves locais. Manter o teste de três rodadas disponível, com modo/protocolo explícito para distinguir novas salas de tabuleiro. Salas antigas não devem ser reinterpretadas como partidas completas.
5. Não alterar regras, preços, cartas, mapa, arte nem adicionar serviços pagos. Não imprimir segredos, enviar `.env` ao Git ou expor tokens com prefixo `VITE`.

## Decisões de arquitetura

- **Servidor como autoridade:** persistir o `GameState` verdadeiro na sala e usar `createGame`/`applyCommand` existentes no servidor. Não criar um segundo motor. Nenhum cliente informa resultado do dado, saldo, posição, RNG ou estado completo como se fosse autoridade.
- **Uma fonte para sorteio:** o dado do tabuleiro vem do motor executado no servidor, com semente gerada no servidor. Não sortear no protótipo e sortear novamente no motor. Derivar o resultado apresentado do evento `diceRolled`. O motor já guarda semente/cursor para continuidade; não expor esses campos em projeções públicas.
- **Persistência atômica:** salvar estado, revisão da sala, recibo do comando e eventos na mesma operação CAS existente. Validar identidade, permissão e argumentos antes de executar. Repetição de um comando deve recuperar seu resultado sem reaplicá-lo; erro de regra não deve virar uma nova tentativa com outro ID.
- **Comandos contextualizados:** usar `commandId`, versão/protocolo, identidade da partida e revisão esperada ou identificador de decisão/turno. Definir claramente revisão da sala versus revisão do motor. Após conflito, atualizar a tela; nunca transformar silenciosamente um clique antigo em ação do novo turno.
- **Projeção explícita:** substituir a omissão superficial de campos de `reply()` por uma lista explícita dos campos permitidos, antes de adicionar estado interno à sala. TV recebe estado de exibição e controles de anfitrião; jogador recebe dados públicos, sua identidade e ações permitidas. Nunca vazar credenciais, recibos internos ou RNG.
- **Automação persistida:** prazos, pausa e próxima transição vivem no servidor. Usar avanço por prazos verificados em leituras/comandos, aproveitando a infraestrutura atual, com CAS e limite de trabalho por requisição. Não depender de um timer em memória ou de uma aba específica para a correção. Reconexão não deve disparar uma sequência ilimitada de passos vencidos.
- **Separar apresentação e execução:** componentes da TV renderizam estado remoto. Não montar `useGameSession` como executor de uma partida remota: ele possui automação e persistência locais. Reaproveitar componentes visuais ou extrair uma camada de apresentação com comandos assíncronos.

## Etapa 1 — dado do celular movimenta o tabuleiro

Esta é a próxima entrega a implementar. Inclui o necessário para completar uma rodada real, mesmo quando aparecer uma decisão intermediária.

### 1. Sala e início de partida

- Acrescentar um modo de tabuleiro identificável no lobby, preservando o teste aprovado.
- Mapear cada identidade autenticada da sala para exatamente um jogador do motor. Congelar participantes ao iniciar; usar regras/configuração/mapa atuais e manter estável a relação de IDs mesmo que o motor sorteie a ordem.
- Anfitrião inicia com 2–10 jogadores. Identidade, ordem e configuração são persistidas. Reiniciar gera nova identidade de partida e invalida ações antigas sem apagar outras salas.

### 2. Comandos e avanço

- Jogador pode solicitar `rollDice` apenas na sua vez e na fase `readyToRoll`, sem pausa ou apresentação bloqueante. O anfitrião tem alternativa para rolar por ele, registrada no histórico.
- **Atenção:** `nextAutoCommand` atualmente retorna `rollDice` em `readyToRoll`. No modo remoto, interromper aí e aguardar o celular. Preservar o comportamento local.
- Depois do dado, avançar por `step`, respeitando bifurcações, interações de passagem, resolução da casa e `endTurn` do motor. Não usar a troca de turno fixa de 2,5 segundos de `settle()` para o tabuleiro.
- Na primeira entrega, bifurcações, loja, pedestal, código/confirmação de carta física, seleção de alvo, defesa e itens continuam operáveis pelo anfitrião usando os painéis existentes. No celular, mostrar claramente “Aguardando decisão na TV”. Não criar atalhos que pulem regras ou bloqueios.
- Preservar a janela de item de cinco segundos e a possibilidade de escolha pelo anfitrião. Decisões humanas não expiram. Provas físicas, equipes, resultados e início de próxima rodada ficam com o anfitrião.
- Pausa deve bloquear automação e comandos de jogo; preservar tempo restante da janela. Definir a retomada explicitamente, sem consumir a janela durante uma pausa.

### 3. TV, celular e recuperação

- TV mostra `Board`, jogador ativo, dado, moedas, bananas douradas, histórico e pendência real. Reutilizar a arte atual.
- Celular mostra nome, vez, saldo e botão grande de dado, com estados de envio, espera e desconexão. Botão desabilitado é conveniência; a autorização obrigatória é no servidor.
- Eventos de apresentação têm identificadores/cursor para não repetir cena, som ou prêmio após recarga. Cenas bloqueantes precisam de conclusão/skip autorizado e idempotente; animação local nunca aplica regras.
- Recarregar TV ou celular recupera o mesmo estado, dado e pendência. Duas TVs autenticadas não duplicam avanço. Erros de comando não podem desaparecer imediatamente porque chegou um heartbeat saudável.
- Não habilitar o desfazer/importar local sobre uma sala remota. Caso ainda não implementados com revisão e persistência no servidor, retirar esses controles no remoto e documentar a limitação. Exportação de backup deve excluir credenciais e ter formato identificado.

### Aceite da etapa 1

1. Dois jogadores entram, o anfitrião inicia e somente o jogador da vez consegue rolar. Uma requisição direta de outro jogador é rejeitada, mesmo sem usar a interface.
2. Um dado produz um único deslocamento; TV e celulares convergem para o mesmo resultado. Cliques simultâneos, resposta perdida e repetição de ID não duplicam efeitos.
3. Uma rodada completa funciona com bifurcação, loja, banana dourada e carta resolvidas na TV; chega à prova, aceita resultado válido uma vez e permite iniciar a rodada seguinte.
4. Recarregar durante movimento, item ou decisão mantém a partida; desconectar um celular não impede a alternativa pelo anfitrião. Pausa/retomada e duas telas de TV não duplicam comandos.
5. Teste de três rodadas e modo local continuam funcionando. A interface móvel não tem rolagem horizontal em 390×844; TV permanece legível em 1920×1080.

Entregar esta etapa para teste de Iago e Emiliano antes de executar a etapa 2. Não declarar “multiplayer completo” ao concluir apenas o dado.

## Etapa 2 — decisões no celular, após validar a etapa 1

Transferir progressivamente `choosePath`, comprar/pular loja, comprar/pular banana, código e confirmação de carta, escolha de alvo e itens. Manter alternativa do anfitrião em todos os casos.

Criar matriz de autorização por comando e pendência. O responsável pela defesa é `pending.targetId`, que pode não ser o jogador ativo. Itens precisam pertencer ao jogador, estar disponíveis e respeitar janela/limites. Nunca aceitar `playerId` do payload como identidade autenticada.

O código impresso da carta continua obrigatório: não substituir o baralho físico por sorteio digital sem nova decisão de produto. Resultados de provas, correções de saldo e comandos administrativos seguem exclusivos do anfitrião.

Aceite: cada decisão aparece só para o responsável; duas respostas concorrentes resolvem uma única pendência; ataques/defesas e uso de itens funcionam sem consumo duplicado; o anfitrião consegue concluir a mesma ação em caso de perda do celular.

## Etapa 3 — ensaio de 8–10 participantes

Após aprovação funcional, executar cenários com 8, 9 e 10 clientes e um anfitrião, usando sementes/cenários reproduzíveis. Completar uma partida e testar recarga, queda e retorno de rede, renovação do WebSocket, duas abas, ações antigas e expiração.

Medir latência entre comando confirmado e TV, requisições/comandos Redis por minuto e comportamento do fallback HTTP. A implementação atual consulta o banco em cada conexão WebSocket; verificar o custo agregado antes de adotar o ritmo para dez celulares. Otimizar apenas com evidência, preservando consistência e plano gratuito.

Registrar resultados, falhas e limites reais; ensaio automatizado não substitui teste com aparelhos e TV.

## Testes e publicação

- Acrescentar testes de serviço com relógio/RNG controláveis para autoridade, validação em runtime, CAS concorrente, idempotência, comandos antigos após reinício, avanço interrompido em decisões, janela de item, pausa e ausência de campos privados nas respostas.
- Reutilizar regressões do motor, sem duplicar a suíte inteira. Acrescentar integração HTTP/WebSocket em `scripts/check-remote.mjs` ou script específico, cobrindo o fluxo do tabuleiro e telas com sessões isoladas.
- Rodar `npm test` e `npm run build`. Verificar artefatos reais das Functions: já houve falha em produção por imports ESM sem extensão. O grafo do motor e seus imports transitivos precisam funcionar no runtime; typecheck Vite sozinho não basta.
- Preparar e verificar a publicação na Vercel existente com a integração atual. Não criar novo banco nem alterar plano. Usar sala exclusiva de QA, sem modificar salas dos usuários. Confirmar URL acessível nos celulares; preview protegido não serve como entrega de teste sem explicar o acesso.
- Após publicar, executar smoke HTTP/WebSocket e navegador no endereço publicado. Documentar deploy, versão, resultados e forma de voltar à versão anterior; atualização deve manter salas antigas compatíveis ou isoladas pelo protocolo.

## Formato da entrega do Claude

Informar: o que está funcionando, URL de teste, roteiro de até cinco passos, testes executados e limitações. Atualizar `docs/TESTE_CONTROLES_CELULAR.md`. Não afirmar que testes humanos aconteceram sem relato do usuário. Não fazer push ou commit de mudanças alheias.

## Instrução para começar

Execute somente a etapa 1 deste plano, incluindo testes e publicação verificável no projeto Vercel existente. Comece lendo o código e estabelecendo a linha de base. Preserve alterações locais e os modos existentes. Use o motor no servidor, com persistência atômica e autorização por identidade; mantenha decisões na TV nesta entrega. Ao concluir, entregue o link e o roteiro para Iago e Emiliano testarem. Aguarde o resultado desse teste antes de implementar a etapa 2.
