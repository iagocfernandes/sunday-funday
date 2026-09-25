# Próxima versão do mapa: barracas e árvores do Fabi

Plano de 24/09/2026. Implementação local registrada na seção final; a etapa 5 continua pendente. Impressão é opcional e não limita compras, poderes ou pontuação digitais.

## Direção proposta

Duas lojas nas barracas do cenário; quatro árvores fixas do Fabi, uma com fruto dourado por vez. Interação ao passar, sem precisar tirar o número exato. Lojas e árvores são pontos de interesse entre casas: não consomem passos do dado. Decisões no celular; TV apresenta o jogo. Computador registra resultados das provas e mantém alternativa administrativa.

Manter aproximadamente o porte atual (36 casas contáveis) como ponto de partida, não como obrigação de desenho. Não acrescentar seis casas para representar os seis pontos de interesse. Redesenhar conexões só quando justificadas por escolha de rota; documentar qualquer mudança de efeitos/distâncias antes de congelar o mapa.

## 1. Esquema jogável antes da arte — primeira entrega

- Desenhar casas, direção, duas bifurcações, duas barracas e quatro árvores sobre uma base simples. Barracas oeste/leste; árvores nas regiões do templo, cachoeira, ponte inferior e um caminho alternativo. Posições exatas são ajustáveis.
- Mostrar entradas das barracas e acessos às árvores ligados ao percurso, sem confusão com casas contáveis. Cada parada pertence a um trecho orientado específico.
- Comparar, a partir de cada bifurcação, passos até lojas e árvores. Evitar uma rota que seja sempre a melhor e uma árvore acessível apenas por um caminho excessivamente longo.
- Conferir dez peças na mesma casa, identificação das escolhas no celular e leitura em TV 1920×1080. Apresentar o esquema para revisão antes de produzir a arte definitiva.

Aceite: é possível seguir o percurso com o dedo, contar casas e explicar onde cada compra acontece. As escolhas de caminho têm destinos reconhecíveis.

## 2. Motor: paradas que não gastam movimento

Estado atual: `arriveAt` em `src/game/engine.ts` já abre loja e pedestal por passagem, mas ambos são associados a casas. `buyGolden` já cobra moedas, limita a uma compra por turno e muda o pedestal. Reutilizar essas regras; separar a parada da casa.

Modelagem sugerida: pontos de interesse em arestas dirigidas (`from`, `to`), com ID, tipo e coordenadas de desenho; árvore ativa identificada por ID. Guardar travessia pendente, destino e ponto já processado no estado persistido. A posição visual pode estar na parada enquanto a posição lógica ainda representa a casa de origem.

Ordem de execução:
1. Com movimento restante, escolher a saída quando houver bifurcação.
2. Detectar ponto de interesse no trecho escolhido; abrir a decisão sem descontar passo.
3. Comprar/passar resolve a parada uma única vez.
4. Chegar à próxima casa e descontar exatamente um passo; continuar ou resolver o efeito de destino.

Uma parada imediatamente antes da última casa alcançada ainda é visitada. Com zero passos não se atravessa o próximo trecho. Árvores inativas não interrompem. Recarga/repetição do comando não reabre parada já resolvida nem desconta movimento novamente.

Propostas para fechar sem ambiguidades:
- Loja: uma compra por visita; mesmo catálogo nas duas barracas. Sem compra disponível, mostrar aviso breve e continuar. Um quarto poder exige escolher descarte antes de confirmar cobrança/entrega em uma operação atômica.
- Árvore: colher custa as atuais 20 moedas; sem saldo, avisar e continuar. Ao recusar, fruto permanece. Ao colher, sortear uniformemente uma das outras três árvores e manter limite de uma banana por turno.
- Nascer fruto ao lado de um jogador parado não gera compra automática; é necessário atravessar o acesso em movimento normal.
- Recuo por evento e troca/teleporte de posição não ativam compras. Troca-Troca usa adversário aleatório e depois mantém o dado normal.
- Muda a Banana troca a árvore ativa entre as outras três sem dar recompensa. Não permite ação durante decisão de compra já aberta.

Criar nova versão de mapa/estado conforme necessário; preservar partidas antigas com suas regras originais. Atualizar validação de saves, projeções públicas e serviço remoto, além do motor local. Não reinterpretar saves antigos como se já tivessem paradas entre casas.

## 3. Celular decide, TV apresenta

- Caminho: opções com destino reconhecível e quantidade de casas até o próximo ponto relevante. Não prometer destino garantido se houver outra bifurcação no meio.
- Loja: poderes, preços, saldo, confirmação de compra, escolha de descarte e botão Continuar.
- Árvore: preço, saldo, Colher e Continuar. TV destaca a árvore visitada.
- Colheita: salvar resultado e novo local, apresentar fruto/recompensa e destacar onde a próxima árvore floresceu. Jogador confirma Continuar pelo celular; só então retomar o restante do movimento.
- Autorizar no servidor somente o responsável pela pendência, com alternativa do anfitrião. Pausa, reconexão e dois cliques não duplicam compras ou avanço. Nenhum clique obrigatório no computador para esse fluxo.

Não implementar o catálogo antigo como se fosse o aprovado. Os seis poderes provisórios são Dado Duplo (dois dados somados), Dado Certeiro, Banana Turbo, Troca-Troca aleatório, Mão no Bolso e Muda a Banana. Implementação completa do catálogo é uma entrega relacionada, mas não deve ser confundida com o redesenho do mapa.

## 4. Arte definitiva sobre o esquema aprovado

- Reaproveitar a direção da ilha tropical, barracas, pontes e templo. Fazer o chão e as passarelas seguirem o grafo aprovado.
- Árvores com identidade comum ligada ao Fabi e silhueta legível. Produzir aparência sem fruto e camada de fruto/brilho para a árvore ativa; não desenhar uma banana permanente no fundo.
- Casas, peças, setas, seleção e informação de jogo continuam em camadas do aplicativo. Cenário não contém números ou indicadores fixos de estado.
- Cartas digitais independem da gráfica. Impressão futura reutiliza a arte, mas não determina estoque digital.
- Seguir a preferência registrada de produzir novas ilustrações no ChatGPT; preparar briefing após aprovar o esquema. Não gerar arte final antes de definir o percurso.

## 5. Verificação e publicação

Testes prioritários: bifurcação antes da parada; última unidade do dado; recusa/compra; sem saldo; inventário cheio e descarte cancelado; compra repetida; recarga na parada; mudança de árvore; duas árvores no mesmo turno; recuo/troca sem compras; saves antigos; autorização de outro jogador e retomada após pausa.

Validar distâncias e acessibilidade de todas as árvores e lojas; simular 8, 9 e 10 jogadores após a mudança, pois uma segunda loja e novos acessos alteram a economia. Não reaproveitar a estimativa antiga de bananas como previsão atual.

Executar testes/build e ensaio com TV + dois celulares: visitar loja, escolher caminho, colher, ver a nova árvore e terminar o deslocamento, sem operar o computador. Publicar na Vercel existente após a validação e conferir a versão efetivamente servida pelo endereço público.

## Ordem até sábado

Quinta: esquema do mapa e fechamento das regras acima. Sexta: motor de paradas + decisões pelo celular + visual funcional. Sábado: arte ajustada, ensaio, correções e congelamento. É uma sequência de trabalho, não garantia de prazo: depende de quanto do controle pelo celular e dos seis poderes já estiver pronto.

Se apertar: manter árvores estáticas com fruto/brilho simples, transições curtas e barracas reaproveitadas. Preservar decisões pelo celular, contagem correta, persistência e testes. Não gastar o prazo com impressão, animações elaboradas ou novos poderes.

Próxima ação concreta: construir o esquema v3 anotado, comparando distâncias e mostrando onde os seis pontos de interesse interceptam o movimento. Só após revisar esse esquema, substituir o mapa usado por novas partidas.

## Execução local — 24/09/2026

Etapas 1–4 implementadas em versão revisável: mapa v3 com 36 casas, duas lojas e quatro árvores em arestas; motor sem gasto de passo nas paradas; decisões do responsável pelo celular; árvore ilustrada transparente e fruto em camada dinâmica. O cenário original foi reaproveitado, sem nova pintura integral do chão. Revisão estética final e avaliação de rotas/economia ficam no ensaio da etapa 5.

Mudanças explícitas: bifurcação leste m17→m16; antigas casas de serviço m6/m14/m18 agora neutras. Schema 4; saves/mapas antigos preservados. Foram implementados também seis poderes provisórios e sorte/azar digital mínimo para completar o fluxo.

Verificação de engenharia: 176 testes passaram e build passou. Prévia visual 1920×1080 e compra/descarte em fixture de celular verificadas. Isso não equivale a ensaio multicelular nem validação de produção. Nenhum deploy desta versão foi feito pelo Codex.

Próxima responsabilidade: Claude executa `docs/CLAUDE_ETAPA_5_MAPA.md`. As regras/preços novos e distribuição das rotas ainda precisam da validação de equilíbrio prevista nessa etapa. A aprovação visual final continua com o usuário.

Comparação inicial de rotas calculada no grafo v3: em m4, os dois caminhos chegam ao acesso do Templo após cinco casas (com efeitos intermediários diferentes). Em m16, m17 leva à Barraca da Cachoeira após uma casa; b0 leva à Árvore da Clareira após uma casa. A escolha leste contrapõe compra de poder e acesso à árvore, sem vantagem automática de distância. Esta contagem não substitui simulação de equilíbrio.
