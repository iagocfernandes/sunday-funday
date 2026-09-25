> Atualização local de 24/09: mapa v3 e decisões no celular implementados. Esta versão ainda não foi publicada. O roteiro vigente de validação é `docs/CLAUDE_ETAPA_5_MAPA.md`; trechos abaixo que descrevem decisões exclusivamente na TV são históricos do protótipo.

# Teste de controles por celular

## Etapa 1 do tabuleiro remoto (2026-09-23)

Endereço: https://sunday-funday-three.vercel.app/?remote=tv → **Criar partida no tabuleiro**. O teste de dados aprovado continua no botão **Criar teste de dados (3 rodadas)**; o jogo local continua na rota inicial, sem mudança.

**O que funciona:** o celular rola o dado do tabuleiro real. O motor (`createGame`/`applyCommand`) roda no servidor com semente gerada no servidor; TV e celulares apenas exibem. Movimento, casas, moedas, bananas douradas, histórico e placar vêm do mesmo estado. Lojas, pedestal, bifurcações, código/confirmação de carta, alvo, defesa, itens, prova e próxima rodada são decididos na TV pelo anfitrião, com os painéis do jogo local. O celular mostra nome, vez, saldo, posição no placar, dado e “Aguardando decisão na TV”.

**Arquitetura:** `server/board.ts` guarda o `GameState` na sala (mesmo CAS atômico). Só o jogador da vez (ou o anfitrião, registrado no histórico) pode rolar, e apenas em `readyToRoll`, sem pausa, com `matchId` e número da vez corretos. Decisões da TV carregam `matchId` e revisão do motor: clique antigo é recusado (409), nunca reaproveitado. Passos automáticos (`beginTurn`, `step`, `resolveSpace`, `endTurn`, fim da janela de item de 5 s) avançam por prazos persistidos, verificados em cada leitura/comando, no máximo 12 por requisição; no dado a automação para e espera o celular. Pausa congela automação e comandos e preserva o tempo restante da janela de item. A resposta é uma projeção explícita: sem credenciais, recibos, semente ou cursor do sorteio. Eventos têm número sequencial; a TV guarda o último exibido por partida e não repete cena após recarga.

**Roteiro (até 5 passos):**
1. No computador ligado à TV, abra o link e clique **Criar partida no tabuleiro**. Iago e Emiliano entram pelo QR code no celular.
2. Clique **Começar com 2 jogadores** e depois **▶ Iniciar rodada 1**. Confira que só o celular da vez tem **Jogar dado** liberado.
3. Role no celular. O peão anda na TV. Quando aparecer bifurcação, loja, banana dourada ou carta, o celular mostra “Aguardando decisão na TV”; decida na TV (carta: digite o código impresso).
4. Durante o movimento ou numa decisão, recarregue a TV e um celular: dado, posição e pendência devem continuar. Teste **⏸ Pausar/▶ Retomar** e **Rolar por [nome]** com um celular fechado.
5. Terminados os turnos, faça a prova, registre o resultado na TV e clique **Iniciar próxima rodada**.

**Limitações desta etapa:** decisões ainda não aparecem no celular (etapa 2). Na TV remota não há Desfazer, Importar nem Exportar backup; correção manual existe no motor, mas não foi exposta na TV remota. Cenas na TV são só apresentação (o servidor não espera a animação terminar). Duas TVs abertas não duplicam comandos, mas ambas mostram as cenas. A presença de cada celular não é medida. Sala em andamento não admite novos jogadores. Etapa 3 (8–10 celulares, custo Redis) não foi executada.

**Verificação:** `npm test` (159 testes, 10 novos em `server/board.test.ts`: autoridade, projeção sem campos privados, cliques simultâneos, repetição de ID, comandos de partida anterior, pausa com janela de item, limite de passos, rodada completa com decisões e resultado único, salas antigas). `npm run build`. Artefatos das Functions importados em Node puro (imports ESM com `.js`, incluindo o motor). `node scripts/check-board.mjs` e `node scripts/check-remote.mjs` aprovados localmente e no endereço público. Navegador: TV 1920×1080 e celular 390×844 sem rolagem horizontal; recarga da TV preservou dado e decisão.

**Publicação:** deploy `dpl_D2v1sMEtocYwzKceB82CLejrRFHz` (production, READY), sem erros nos logs após os testes. Salas antigas (sem `mode`) continuam como teste de dados. Para voltar à versão anterior: `npx vercel rollback sunday-funday-q33l3cdsr-iagocfernandes-4464s-projects.vercel.app` (ou promover esse deploy no painel da Vercel). Nada foi commitado nem enviado ao Git.

## Teste de dados (protótipo aprovado)

Protótipo separado do tabuleiro completo. O aplicativo local permanece na rota inicial. Abra `/?remote=tv` no computador; cada jogador abre o QR code ou `/?remote=join&room=CODIGO` no próprio navegador. O anfitrião inicia após pelo menos duas entradas. São três rodadas, dado 1–10, na ordem de entrada. O resultado fica em destaque por 2,5 segundos e a vez passa automaticamente. O limite é dez participantes.

## Operação

1. No computador conectado à TV, clique em **Criar teste de dados (3 rodadas)**.
2. Iago e Milena entram no QR code, cada um com seu nome, em dois navegadores. É possível usar um celular e outra aba do computador como segundo jogador.
3. No computador, clique **Começar com 2 jogadores**. Cada jogador usa **Jogar dado** apenas na própria vez.
4. Recarregue um celular após rolar: identidade e resultado devem reaparecer, sem nova rolagem. O botão **Rolar por [nome]** permite ao anfitrião ajudar alguém.
5. Ao completar três rodadas, use **Repetir teste com os mesmos jogadores**. As salas expiram em doze horas.

## O que está implementado

- Banco Redis compartilhado, provisionado via Vercel Marketplace: plano gratuito, upgrade automático desligado, região gru1.
- Vercel Functions: HTTP autenticado para comandos e WebSocket para atualizações. O projeto usa Fluid Compute. Conexões são reabertas ao encerrar a duração máxima da Function; uma leitura HTTP periódica mantém a atualização caso o WebSocket esteja indisponível.
- Estado persistente com compare-and-set atômico. Cada comando tem identificador, cada turno tem número monotônico. Toques duplicados, tentativas antigas e ações fora da vez são recusados ou reconhecidos sem duplicar resultado.
- Resultado sorteado no servidor. Celular não escolhe número. Segredos de anfitrião e jogadores não aparecem no estado enviado à TV.
- Identidade salva neste navegador antes da entrada, permitindo recuperar resposta perdida. Não há login por e-mail; usar outro navegador não recupera automaticamente a identidade anterior.
- Limitação de criação e ações por IP, com salas de duração limitada. Em produção, ausência/falha do banco interrompe operação; não existe fallback de estado em memória.

## Limites deste protótipo

Não integra movimento, lojas, cartas, moedas, placar de bananas nem minigames. Não mede presença individual: **Pronto** na lista significa que a pessoa entrou, não que seu telefone esteja necessariamente conectado agora. Não é o modo completo para domingo. Uma sala em andamento não admite novos jogadores; abra outra se alguém perdeu o navegador original. O modo remoto depende da internet. O modo local existente não passa a sincronizar automaticamente nem recebe uma cópia dessas salas.

## Desenvolvimento e verificação

`npm run remote:api` carrega `.env.local` e sobe a API em 127.0.0.1:3001. `npm run dev` encaminha `/api` e WebSockets a essa API. Credenciais `KV_REST_API_URL` e `KV_REST_API_TOKEN` vêm da integração e nunca devem ser expostas com prefixo VITE.

`npm test` inclui regressões de concorrência, autoridade, idempotência, recuperação, ordem, conclusão, expiração e limite de participantes. `npm run build` valida cliente e servidor.

`node scripts/check-remote.mjs` verifica criação, entradas, rejeição de jogador fora da vez, WebSocket, requisição duplicada, troca de jogador e recarga contra banco real. Use `TEST_REMOTE_URL` para outro endereço. O teste cria uma sala separada, com dados fictícios e expiração automática.

Próxima etapa, depois do teste humano: integrar os comandos ao motor do tabuleiro, manter o anfitrião como alternativa operacional e definir a política de uso de item antes do dado no modo celular.

## Publicação verificada

Publicado em https://sunday-funday-three.vercel.app/?remote=tv . Deploy validado: `dpl_DDMgo7H8FzWSh45n1ZxEZngBbsEb` (production, READY). Foram aprovados 149 testes e build, além do script de integração no endereço público. A leitura dos dez registros iniciais do deploy validado não encontrou respostas 5xx. Uma primeira publicação teve falha de resolução de módulos ESM; foi substituída pela versão com imports explícitos `.js`, cujos artefatos também foram importados localmente antes da publicação. A última versão do aplicativo local e o protótipo foram publicados sem commit/push no Git.
