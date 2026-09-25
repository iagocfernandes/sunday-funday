# Personagens aprovados — versão inicial

O usuário aprovou a prancha `references/personagens-arthur-mari-milena-aprovados-v1.png` como versão inicial dos três personagens.

- Esquerda: Arthur. Gorila maior e robusto, cabelo curto dourado, pelagem dourada e armadura de metal com couro.
- Centro: Mari. Cabelo longo loiro claro, traje de metal e couro, detalhes de tecido vinho.
- Direita: Milena. Cabelo longo com raiz castanha e comprimentos mais claros, traje de metal e couro, detalhes vinho.

A imagem aprovada é a referência visual prioritária para esses personagens, inclusive rostos, proporções, roupas, cores e acessórios. Sua aprovação substitui as sugestões anteriores de roupas contemporâneas ou de evitar armaduras. Não corrigir os personagens para corresponder aos prompts anteriores.

Próxima produção: imagens individuais de corpo inteiro com transparência real, preservando o desenho aprovado. Produzir no ChatGPT conforme preferência do usuário para poupar geração de imagens no Codex. Não gerar automaticamente nesta sessão.

A prancha é referência, não sprite final: tem fundo creme e sombras de chão. Os arquivos individuais precisam de margem, pés inteiros e ausência de sombras externas, pois bases e sombras serão colocadas pelo aplicativo.

Aprovação de personagens não implica aprovação de mudanças nas regras, na interface ou no mapa.


## Direção atual — 24/09/2026

- Impressão 100% opcional. Poderes e bananas precisam existir visualmente no aplicativo; disponibilidade de papel não pode bloquear compras, inventário nem pontuação. As 30 cartas físicas e 12 bananas são apenas uma opção de produção, não limites digitais aprovados.
- Seis poderes mantidos provisoriamente: Dado Duplo, Dado Certeiro, Banana Turbo, Troca-Troca, Mão no Bolso e Muda a Banana. Nomes podem mudar. Troca-Troca escolhe o adversário ALEATORIAMENTE. O catálogo ainda precisa ser implementado; não tratar nomes como funções prontas.
- Sorte e Azar são eventos digitais separados, apresentados na TV e confirmados pelo jogador da vez no celular. Sem necessidade de códigos físicos. Fluxo ainda pendente na implementação atual.
- Prioridade imediata: avançar o jogo e o mapa; gráfica não é requisito de lançamento.

### Primeira implementação visual do mapa

Recomendação: manter 36 casas (28 principais + dois desvios de quatro), em uma única ilha visível na TV. Não aumentar o percurso antes de medir uma partida completa: tamanho maior altera ritmo e acesso à banana. Layout visual maior não exige mais casas.

O mapa padrão novo tem ID `ilha-dos-gorilas-v2`, mesmas ligações/efeitos/IDs de casas, coordenadas redesenhadas sobre `public/assets/board/ilha-v1.png`. O componente Board real usa a arte, setas de direção, caminhos alternativos pontilhados, legenda e marcador de banana. Mapas já salvos mantêm suas coordenadas e fundo esquemático, sem migração silenciosa. As rotas alternativas recebem traçado sobre o cenário; a arte não contém todos esses caminhos originalmente. Uma revisão de arte pode alinhar as passarelas posteriormente.

Esta é uma primeira composição funcional, não arte final aprovada: retratos genéricos permanecem; personagens aprovados não foram reinterpretados nem gerados de novo. Local e remoto usam o mesmo Board. A mudança está local, ainda não publicada. Prévia de revisão em `output/mapa-v2-previa.png` e ocupação inicial em `output/mapa-v2-inicio.png`.

Próximas entregas: decisões completas no celular, eventos digitais com confirmação, seis poderes e limite de três com descarte, design das cartas digitais, ensaio de partida. Impressão somente depois, se desejada.

## Mapa v3 — implementação para revisão em 24/09

Mantida a direção tropical existente. Adicionados quatro exemplares da árvore do Fabi, com arte transparente em `public/assets/board/arvore-fabi-v1.png` gerada nesta execução autorizada da etapa visual. Fruto/brilho são camadas do aplicativo, não elementos permanentes da imagem. Barracas usam as construções visíveis do cenário com placas PODERES e acessos explícitos. Lojas/árvores não são casas contáveis. Prévia: `output/mapa-v3-previa.png`.

Esta composição está implementada localmente, sujeita à revisão visual do usuário. Não registra aprovação específica da nova arte nem publicação. Caminhos e serviços são desenhados pelo aplicativo sobre o cenário reaproveitado; não foi feita pintura integral de um novo fundo.

## Revisão solicitada pelo usuário após ver o v3

O usuário considerou o mapa poluído e a implantação de caminhos, árvores e lojas improvisada. Recomeçar pela planta, depois gerar novo cenário. A árvore deve ter rosto no tronco. Referência vigente de trabalho: `docs/REDESENHO_MAPA_V4.md`; a composição v3 não está aprovada como arte final.
