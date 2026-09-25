# Redesenho do mapa — planta antes da ilustração

Pedido do usuário em 24/09/2026: a versão v3 ficou visualmente poluída; ramificações, lojas e árvores parecem improvisadas. Refazer primeiro os caminhos e a localização dos elementos, depois produzir o novo mapa aqui. A árvore do Fabi deve ter um rosto no tronco.

## Proposta 01

Planta em `output/mapa-v4/planta-percurso.png` e SVG editável no mesmo diretório. Coordenadas em `output/mapa-v4/layout-proposto.json`. É uma proposta para revisão, não foi aplicada ao motor ou publicada. Os ícones da planta só indicam espaço e função; não são a arte final.

1. Circuito principal contínuo com 28 casas e dois desvios de quatro casas cada: 36 casas no conjunto. Separação ampla entre trilhas; nenhuma rota cruza outra.
2. Duas barracas, cada uma em um pequeno largo lateral. Praia no oeste; Mirante no sudeste (nome proposto para a antiga loja da Cachoeira). A trilha permanece contínua na frente da barraca.
3. Quatro árvores em clareiras próprias: Templo no norte, Cachoeira no nordeste, Ponte ao sul e Clareira na trilha interna leste. Reservar espaço para copa, tronco, rosto e fruto sem encobrir casas/setas.
4. Separar a coordenada da parada na trilha da coordenada visual da árvore/barraca. O ponto dourado é onde a interação acontece. O pequeno acesso lateral é visual: não acrescenta casas ou deslocamento mecânico.
5. Centro com rio e vegetação baixa para dar respiro. HUD, placar e anúncios ficam fora da ilustração. Evitar números, nomes, bananas ou brilhos permanentes no fundo.

## Percursos e decisões

Os IDs e conexões da proposta mantêm a topologia v3, com novas coordenadas desenhadas do zero. Os números da planta são referências para discussão, não novos efeitos.

- Escolha 1: casa 05 segue por 06–09 ou 29–32, reencontrando em 10. Ambos têm cinco passos até o reencontro; o contraste é a sequência de efeitos, a definir/revisar antes de fechar a arte. O acesso à árvore do Templo fica depois da união, entre 10–11.
- Escolha 2: casa 17 segue por 18–22 ou 33–36, reencontrando em 23. Exterior: seis passos até a união e visita à loja entre 18–19. Interior: cinco passos e acesso à árvore da Clareira entre 33–34. A árvore pode estar inativa; não garantir vantagem automática da rota interna.
- Demais acessos: loja da Praia entre 03–04; árvore da Cachoeira entre 14–15; árvore da Ponte entre 23–24.

## Direção de arte para a próxima passagem

Produzir uma ilha nova seguindo a planta, em perspectiva elevada com pouca oclusão. Construções e terreno devem ser planejados junto com as rotas, sem reaproveitar o antigo fundo como restrição. Trilhas largas, pavimento discreto e espaçamento suficiente para casas e peças. Zonas tracejadas reservam a ocupação das ilustrações; nenhum galho, copa, telhado, placa ou efeito cobre a rota jogável.

Árvore do Fabi: rosto integrado à casca, com olhos, sobrancelhas e boca legíveis no tronco. Expressão acolhedora e levemente travessa; tronco voltado para a câmera, copa alta deixando o rosto visível. As quatro árvores têm a mesma identidade. Fruto dourado e brilho em camada separada, somente na árvore ativa. O rosto não será uma placa ou texto FABI.

Sequência de execução: revisar esta planta com o usuário; fechar localização e diferenças entre rotas; gerar a nova arte a partir do esquema; integrar cenário e elementos dinâmicos; conferir legibilidade com dez jogadores. Não considerar a arte v3 aprovada ou definitiva. Nenhuma publicação realizada nesta rodada.
