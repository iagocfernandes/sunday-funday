# Sunday Funday

Jogo de tabuleiro local com temática de gorilas, operado no computador do anfitrião
e espelhado na TV. Sem backend, sem contas, sem celular dos participantes.

O requisito central é a **rodada automática**: um clique em *Iniciar rodada* e os
8–10 gorilas jogam sequencialmente. O aplicativo anuncia o jogador, rola o dado,
move a peça, resolve efeitos sem escolha e passa ao próximo sozinho. Ele só para
em decisões humanas.

---

## Comandos

Instalar (precisa de internet apenas nesta etapa):

```bash
npm install
```

Rodar em desenvolvimento:

```bash
npm run dev
```

Gerar o build de produção:

```bash
npm run build
```

Servir o build (é o modo recomendado para a festa):

```bash
npm run preview
```

Verificações:

```bash
npm test
```

```bash
npm run build
```

O `npm run build` roda a checagem de tipos antes de empacotar.

### Executar sem internet

Depois de `npm install` e `npm run build`, tudo fica local: os assets estão em
`public/assets/` e são copiados para `dist/`. Rode `npm run preview` com a rede
desligada e abra `http://localhost:4173` no navegador.

Não abra o `index.html` com dois cliques — o aplicativo precisa de um servidor
local (o `preview` faz isso). Para a TV, abra o navegador em tela cheia (F11) na
tela espelhada.

---

## Operação durante a festa

### Começar

1. Tela inicial: **Nova partida**, **Continuar partida**, **Importar backup** ou
   **Demonstração (8 gorilas)**.
2. Na preparação, cadastre 8–10 nomes, ajuste a configuração, sorteie a ordem e
   confira o resumo das regras. O grafo do mapa é validado antes de começar.
3. Clique em **Começar jogo**.

### Conduzir a rodada

- **Iniciar rodada** (uma vez por rodada) conduz todos os turnos.
- O jogo para sozinho em: bifurcação, loja, pedestal, código de carta física,
  escolha de alvo e escolha de defesa. Nenhuma dessas decisões expira.
- Quem tem item **ativo** utilizável ganha 5 segundos com **Usar carta** e
  **Seguir agora**. Quem só tem item defensivo (escudo, reverse) não espera.
  Clicar em *Usar carta* suspende o prazo; cancelar significa não usar item e a
  janela não recomeça.
- **Pausar / Retomar**, **Velocidade** (normal/rápida) e **Desfazer** ficam
  sempre disponíveis. O Desfazer pertence a uma única partida: abrir outra
  partida (nova ou importada) descarta a pilha da anterior. A velocidade nunca encurta a janela de 5 s nem confirma
  decisões.
- Nas provas individuais, as posições usam classificação competitiva: empatados
  no primeiro dividem a 1ª posição e o seguinte ocupa a 3ª. Não é possível
  preencher uma posição deixando a anterior vazia.
- Depois do último turno abre a prova presencial. O jogo fica parado nessa tela
  enquanto as pessoas jogam. O anfitrião registra o resultado, revisa a prévia da
  premiação e confirma. Confirmar duas vezes não duplica nada.
- A próxima rodada só começa com **Iniciar próxima rodada**.

### Retomar depois de uma interrupção

Recarregar a página, trocar de aba ou importar um backup sempre devolve a partida
**em pausa manual**. Nada avança até você clicar em **Retomar**. O dado já rolado,
a decisão pendente e o tempo restante da janela de item são preservados — retomar
não rerola nem reaplica efeitos.

Para retomar: abra o aplicativo, clique em **Continuar partida** e depois em
**Retomar**.

### Backup

- Autosave em `localStorage` após cada comando aceito.
- **Exportar backup** (painel do anfitrião) baixa um JSON a qualquer momento.
- Um backup é baixado automaticamente no fim de cada rodada.
- **Importar backup** na tela inicial valida schema, enums, números, inventários,
  fase, decisão pendente e todas as referências. Um arquivo inválido é recusado
  sem gravar nada: a partida atual e o último estado válido ficam intactos.
- A mesma validação roda ao **retomar**. Se o último autosave estiver corrompido,
  a tela inicial avisa e recupera o snapshot imediatamente anterior — confira os
  saldos antes de clicar em Retomar.
- Se a gravação falhar (cota cheia, por exemplo), o aplicativo **para a
  automação**, mostra um alerta persistente e oferece exportação. Ele nunca diz
  "salvo" quando não salvou.

### Correção manual

No painel do anfitrião: escolha o gorila, os novos saldos e informe o motivo
(obrigatório). O antes/depois aparece antes de aplicar e a correção entra no
histórico.

---

## Modo de demonstração

A opção **Demonstração** cria 8 gorilas fictícios com 2 rodadas. Serve para
verificar o fluxo completo sem baralho físico e sem realizar provas reais: as
cartas podem ser escolhidas na lista de cartas elegíveis e os resultados dos
minigames são informados manualmente.

---

## Arquitetura

```text
src/
  game/          tipos, motor puro (reducer), RNG determinístico, validação
  data/          mapa, cartas, itens, minigames e defaults de configuração
  persistence/   snapshots, migração de schema, export/import, bloqueio de aba
  presentation/  manifesto de cenas do livro (imagem, vídeo opcional, duração)
  automation/    coordenador de turnos, timers canceláveis, janela de item
  components/    tabuleiro SVG, placar, decisões, prova, cenas
  screens/       início, preparação, partida
public/assets/   board/ portraits/ cards/ scenes/ audio/
```

Princípios que o código segue:

- O motor é puro e separado dos componentes. Todo comando carrega a revisão
  esperada; revisão errada é rejeitada, o que elimina callbacks antigos, cliques
  duplos e montagem dupla do React.
- Existe **um único** coordenador automático. Timers são cancelados em pausa,
  desfazer, troca de fase, importação e desmontagem, e uma "geração da execução"
  invalida qualquer callback já enfileirado.
- O estado é salvo **antes** de começar qualquer animação. A camada visual não
  altera saldos: terminar, pular ou falhar uma cena produz exatamente o mesmo
  estado.
- Nenhuma regra depende de um vídeo existir ou terminar. Vídeo ausente, formato
  incompatível, autoplay recusado ou erro de carregamento caem imediatamente na
  imagem estática.

### Livro dos gorilas

Eventos do motor viram cenas em três níveis: pequeno (dado, ganho/perda), médio
(carta, item, ataque) e grande (banana dourada, minigame, final). Nome, retrato e
valores são desenhados pela interface sobre arte genérica — nada é gravado na
mídia, então uma cena de comemoração serve para qualquer participante.

Para trocar uma cena por um vídeo local, coloque o arquivo em
`public/assets/scenes/` e aponte o campo `video` da chave correspondente em
`src/presentation/manifest.ts`. O MVP funciona sem nenhum vídeo.

---

## Configuração

Todos os valores de regra ficam em `src/data/config.ts` e são editáveis na tela
de preparação. **São propostas de teste, não regras aprovadas**: rodadas, faixa
do dado, saldo inicial, preço da dourada, casas +/−, limite de inventário,
preços da loja e tabelas de premiação.

A única exceção é a **janela de 5 segundos** para itens ativos, que é decisão
confirmada e não é editável pela interface.

O **ladrão** vem desligado por configuração, conforme o plano.

## Protótipo: controles pelo celular

Abra `/?remote=tv` para criar uma sala de teste e exibir o QR code. Dois a dez
jogadores podem entrar pelo celular e rolar um dado 1–10 na própria vez, durante
três rodadas. Resultados são salvos no servidor e a vez passa automaticamente.
O anfitrião pode rolar por um jogador. Este teste é separado da partida local e
não inclui ainda o movimento do tabuleiro, poderes ou minigames.

Veja `docs/TESTE_CONTROLES_CELULAR.md` para operação, recuperação e limites.
Para desenvolver: `npm run remote:api` e `npm run dev` em terminais separados.
O banco conectado pela Vercel fornece as variáveis em `.env.local`; não inclua
essas credenciais no cliente ou no repositório.
