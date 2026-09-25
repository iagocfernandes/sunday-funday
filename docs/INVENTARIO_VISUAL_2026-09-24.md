# Inventário visual — Sunday Funday (24/09/2026)

## Estado de referência

Direção vigente: ilha tropical legível, casas e serviços separados, rosto da Árvore do Fabi visível, textos/HUD fora da arte do cenário. `public/assets/board/ilha-v4.png` é a arte aprovada da ilha e já contém barracas, Iagugu com cabana/bandeira e quatro árvores com rosto. A UI aprovada usa ultra bold sans, creme/preto/amarelo e teal/verde/coral funcionais, com gorilas oficiais em realismo estilizado. A REF oficial é `public/assets/references/personagens-oficiais.png`; retratos genéricos antigos só permanecem como fallback visual sem migrar saves ou fotos.

Paleta já usada no CSS: mata `#12200f` / `#1d3018`, dourado `#f2b134`, azul `#4ea8de`, vermelho `#e5574f`, roxo `#b083e0`, verde `#57cc99`. A identidade forte vem de contornos creme, madeira/folhagem tropical e dourado de banana; manter o mesmo vocabulário na TV, celular, cartas e ícones.

## Inventário concreto

| Componente | Asset existente / caminho | Criar imagem ou CSS/SVG | Prioridade | Proporção, tamanho e transparência | Reutilização |
|---|---|---|---|---|---|
| Direção visual/UI | `public/assets/references/direcao-tropical-bold.png` (1672×941, RGB), prévia aprovada; `docs/REFERENCIA_OFICIAL_2026-09-24.md` registra a linguagem | CSS/SVG aplicado; não redesenhar a prévia como nova topologia | **Pronto como referência** | 16:9; imagem opaca; tipografia, cores, molduras e botões já aplicados no Studio/TV/celular | Design Studio, Home, TV, celular, cartas e HUD |
| Entrada inicial (Home/remote) | `docs/references/tela-inicial-conceito.png` (1672×941, RGB); Home atual só usa gradiente/CSS | **Imagem** de fundo/hero 16:9 + logo e botões em CSS/SVG | P1 | 16:9, 1920×1080 ou maior; fundo sem transparência; logo SVG transparente | Home local, entrada TV e página de entrada remota |
| Preparação e entrada dos jogadores | `src/components/PlayerPortrait.tsx` enquadra portraits oficiais; `public/assets/portraits/gorila-1..5.png` (640×760, RGB) são fallback legado; `output/celular-iagugu-v4.png` é prévia | CSS/SVG pronto para cartões, campos, chips e estados; fallback visual não altera saves/fotos | Pronto | cartão responsivo; avatar 1:1, 128–256 px; foto do usuário é JPEG quadrado 128×128 (~10 KB) | Setup, roster remoto, placar e decisões |
| Cenário do tabuleiro | `public/assets/board/ilha-v4.png` (1672×941, RGB, sem alpha), aprovado; já inclui barracas, Iagugu/cabana/bandeira e quatro árvores com rosto; `ilha-v1.png` é legado | Preservar **imagem**; caminhos/efeitos, motion e LivingIsland ficam sobrepostos | Pronto | 16:9, base estável; camadas localizadas são refinamento opcional | TV local/remota; não redesenhar a ilha nem usar screenshots `output/` como produção |
| Casas, setas e bifurcações | Desenhadas em `src/components/Board.tsx`/`BoardV4.tsx` com SVG; sem sprite | CSS/SVG integrado, sem imagem raster adicional | Pronto | símbolos 1:1, pelo menos 32–44 px na TV; contraste alto | 36/48 casas, legenda, estados visitado/ativo/escolha |
| TV/HUD principal | `src/remote/BoardRemote.tsx` (`BoardTv`) compõe HUD; `output/tv-hud-48*.png` e `tv-duelo-v4.png` são screenshots de conferência | CSS/SVG já aplicado; GameIcon, PlayerPortrait, motion, LivingIsland e áudio integrados | Pronto | layout 16:9, alvo 1920×1080 e fallback 1366×768; painéis opacos/translúcidos controlados | TV local/remota: vez, rodada, pausa, dado, placar até 10 |
| Celular remoto | `output/celular-duelo-header.png` (390×650), `celular-duelo-compacto.png` (390×650), `celular-loja-v3.png` (390×1288) são prévias; `BoardPhone` é componente real | CSS/SVG aplicado; GameIcon e molduras nativas | Pronto | viewport 390×650–844; rolagem vertical real; ícones 24–32 px e botões com área ≥44 px | Entrada, rolagem, bifurcação, loja, cartas, alvo, defesa e tarefas |
| Peões e personagens | `public/assets/characters/arthur-v1.png`, `mari-v1.png`, `milena-v1.png`; `PlayerPortrait` aplica enquadramento CSS; `public/assets/references/personagens-oficiais.png` é a fonte | **Pronto para UI**; recortes artísticos adicionais são opcionais | Pronto | sprites 2:3, 1024×1536, RGBA; foto de jogador segue seu próprio fluxo | Peão grande, cena, vitória, card reveal e HUD |
| Fotos dos participantes | Upload preparado em `src/remote/photo.ts`; fallback genérico em `public/assets/portraits/` | CSS/SVG para moldura; foto é dado do usuário, não asset editorial | P2 | 1:1, JPEG 128×128; sem metadados; moldura circular 30–84 px | Peão, placar, TV ativa, celular e cena |
| Dado | `src/styles/app.css` (`.dice`) é bloco CSS 62×62; sem asset raster | CSS/SVG integrado, com faces 1–10 e estado rolando | Pronto | 1:1, 62–96 px TV e 48–64 px celular; alto contraste | Barra inferior, HUD TV, janela de decisão |
| Lojas e casas | As duas barracas já estão embutidas em `public/assets/board/ilha-v4.png`; paradas/placas de estado são SVG/HTML; `arvore-fabi-v1.png` é recorte auxiliar | Preservar cenário; estados já aplicados; camadas localizadas são refinamento opcional | Pronto | composição 16:9; não cobrir trilha/casas | Barraca da Praia, Barraca do Mirante e estados de parada |
| Árvores do Fabi | Quatro árvores com rosto já estão embutidas em `public/assets/board/ilha-v4.png`; `public/assets/board/arvore-fabi-v1.png` (1254×1254, RGBA) é auxiliar | Preservar árvores; fruto, brilho e estado ativo já têm apresentação; camada isolada é opcional | Pronto | composição 16:9; manter rosto e copa do cenário | Quatro paradas, marcador de árvore ativa e cena dourada |
| Moeda, banana, Sorte e Azar | `src/components/GameIcon.tsx` fornece ícones nativos; banana e moeda já aparecem em TV/celular/cartas | CSS/SVG aplicado; arte dedicada adicional é refinamento opcional | Pronto | ícones escaláveis, leitura em 24–40 px | Carteira, casas, eventos, HUD, loja e vitória |
| Iagugu | Personagem, cabana e bandeira já estão embutidos em `public/assets/board/ilha-v4.png`; ações e valores são UI | CSS/SVG integrado; recorte separado é opcional | Pronto | composição 16:9; modal responsivo | Parada no mapa, modal de roubo, cena e histórico |
| Seis poderes da loja | Catálogo em `src/data/config.ts`; arte pronta em `public/assets/powers/poderes-tropical-v1.png` (1536×1024, RGBA, sprite 3×2), recortada por `src/components/PowerCard.tsx` | **Pronto como arte**; CSS mantém moldura, preço, descrição e uso | P1 concluída | Cada célula 512×512 px RGBA, leitura a 24–40 px; ícone sem texto embutido | Loja, inventário, TV, celular e cenas de uso |
| 13 eventos da Milena | `src/data/cards.ts`, reveal e molduras CSS já funcionam para os 13 nomes/descrições; Preview exercita Sorte, Azar e duelo | **Refino de imagem** individual por evento; interface atual fica | P2 refinamento | reveal 16:9; textos continuam HTML; sem bloquear a interface | Carta digital/reveal TV, celular e eventual impressão opcional |
| Cenas de carta, ataque, defesa e banana | `src/presentation/manifest.ts`, `SceneOverlay` e `BoardTv` usam retrato/moldura/gradiente; síntese original de áudio integrada | **Pronto como apresentação**; filme/recortes limpos para cinemagraph são opcionais | Pronto + opcional | 16:9 no painel; recortes 2:3 RGBA se o refinamento for feito | Eventos, seis poderes, ataque/defesa, banana e turnos |
| Minigames e preview de jogo | `src/design/GameplayPreview.tsx` usa motor local, `BoardTv`/`BoardPhone`, 10 jogadores, loja, duelo, eventos e simulação de 3 passos | CSS/SVG aplicado nos componentes reais; sem API externa | Pronto | TV 16:9 e celular responsivo; fixture isolada | Demonstração do Studio e QA funcional antes de publicar |
| Vitória/coroação | `src/presentation/manifest.ts` e `Scoreboard.tsx` usam composição de cena/pódio CSS; GameIcon e PlayerPortrait integrados | CSS/SVG pronto; filme/recortes cinematográficos são opcionais | Pronto + opcional | 16:9, 1920×1080; refinamento pode usar RGBA | Vitória de minigame, campeão final, compartilhamento |

## Lacunas que afetam a identidade

- O refinamento individual das 13 cartas/eventos ainda falta, mas não impede a interface nem o Preview.
- A trilha musical final ainda falta; a síntese original atual é provisória, com áudio de eventos integrado.
- Filme/recortes limpos para efeitos cinemagraph podem elevar a qualidade, mas são opcionais.
- QA em aparelho real e publicação ainda não foram realizados.
- A arte v4 aprovada deve ser preservada; não substituir o cenário por uma nova pintura nem usar screenshots `output/` como assets de produção.

## Cinco assets que mais valem produzir primeiro

1. **Refino individual das 13 cartas/eventos** — acabamento visual por evento mantendo texto HTML e a interface existente.
2. **Trilha musical final** — substituir a síntese original provisória após validação de clima e volume.
3. **Filme/recortes limpos para cinemagraphs** — opcional, para elevar cenas de ataque, banana e vitória.
4. **QA em aparelho real** — validar TV, celular, movimento reduzido, áudio e molduras nos tamanhos alvo.
5. **Publicação** — executar somente após QA e revisão do Preview local.
