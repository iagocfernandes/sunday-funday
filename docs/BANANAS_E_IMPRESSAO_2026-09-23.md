> Atualização de 24/09: impressão passou a ser 100% opcional. Quantidades e baralhos físicos abaixo são histórico de planejamento; não limitam o jogo digital. Ver `DIRECAO_VISUAL_APROVADA.md`.

# Quantidade de bananas e aproveitamento A3

## Recomendação atual

44 cartas de 60 × 85 mm (12 sorte, 12 azar, 20 poderes) e 20 bananas unitárias de 38 × 54 mm. Total: 64 peças em três folhas A3. R$105 se R$35 cobre cada folha frente e verso; R$210 se a cobrança for por face. Corte/acabamento dependem do orçamento. Este plano substitui a proposta de dez cartas simbólicas de coleção: cada banana física volta a representar uma unidade.

## Simulação realizada

1.200 partidas completas no motor existente: dois catálogos (atual e proposto), duas políticas de decisão, três contagens de jogadores e cem sementes por combinação. O catálogo proposto foi injetado apenas na memória do script; não foram alterados regras, arquivos de catálogo do app ou saves.

Premissas: oito rodadas; dez moedas iniciais; banana por vinte moedas; dado 1–10; mapa atual com pedestal móvel; provas na sequência padrão, vencedores aleatórios sem empates; sorte/azar com duas cópias por tipo, reembaralhando ao esgotar. Poderes ativos usados quando disponíveis e defesas usadas quando elegíveis. Uma política compra item a cada oportunidade e escolhe caminhos aleatórios; a outra não compra itens e procura o caminho mais curto até o pedestal atual. Ambas compram banana sempre que o motor oferece. O estoque da loja é ilimitado nesta simulação, como no motor atual; o estoque de cinco poderes por tipo ainda é proposta não implementada.

Resultados com o catálogo físico proposto:

| Jogadores | Média total, comprando itens | Média total, economizando/procurando pedestal | Maior total observado entre as duas políticas |
|---|---:|---:|---:|
| 8 | 5,00 | 6,76 | 12 |
| 9 | 5,63 | 7,39 | 14 |
| 10 | 5,84 | 8,12 | 14 |

Média por pessoa: aproximadamente 0,58–0,85 banana. Máximo individual observado em todas as 1.200 partidas: três. O percentil 95 do total por cenário ficou entre sete e onze bananas; não equivale a uma garantia para partidas humanas. Vinte unidades superam o maior total observado em seis unidades (cerca de 43%). Não há descarte de bananas compradas nas regras atuais: a demanda acumulada é o total ao final.

Exemplo de evolução acumulada: dez jogadores economizando, catálogo proposto, médias de 0,5 banana no fim da segunda rodada, 2,5 na quarta, 5,2 na sexta e 8,1 na oitava. Não significa distribuição igual entre pessoas.

O teto teórico de oitenta compras não era previsão de consumo. As compras dependem de moedas E passagem pelo pedestal, que muda após cada compra. As recompensas da última prova chegam depois da última oportunidade de compra no tabuleiro.

Limitações: estratégias humanas não foram medidas; mapa/rodadas/preços não estão congelados; minigames reais e estoque finito podem mudar o resultado. Se a intenção for duas ou três bananas por pessoa em média, a economia atual precisa ser ajustada e simulada de novo. Não afirmar que vinte cartas cobrem qualquer mudança futura. Se excepcionalmente acabarem, o banco deve reconhecer a compra no app e fornecer marcador provisório, nunca impedir pontuação por falta de papel.

Resultados completos: `ESTIMATIVA_BANANAS_2026-09-23.json`. Reprodução: empacotar `scripts/estimate-golden.ts` com esbuild para Node e executar. Cem sementes determinísticas por cenário: `10001 + i * 7919`.

## Imposição geométrica conferida

Folha A3: 297 × 420 mm. Margem externa mínima: 10 mm. Sangria independente: 3 mm em cada lado. Texto/código das cartas grandes a pelo menos 3 mm dentro do corte; bananas com arte simples, numeral 1 e título legível. As posições abaixo representam caixas COM sangria, em milímetros a partir do topo/esquerda. A gráfica precisa confirmar área imprimível, registro frente/verso e corte misto; não imprimir ajustando à página.

- Folhas 1 e 2: dezoito cartas grandes por folha. Caixas de 91 × 66 mm, três colunas por seis linhas, origem (12,12). Total: 36 cartas grandes.
- Folha 3: oito cartas grandes e vinte bananas. Grandes em duas linhas completas de três, mais duas na terceira linha, com a mesma grade/origem. Duas bananas ocupam a terceira posição dessa terceira linha, com caixas de 44 × 60 mm nas origens (194,144) e (238,144). As dezoito bananas restantes ficam abaixo, em seis colunas por três linhas, origem (12,210), passo de 44 mm na horizontal e 60 mm na vertical.

Todas as caixas foram verificadas por cálculo: nenhuma sobreposição e nenhuma invade a margem externa de 10 mm. Cortes mistos requerem separar faixas antes de cortar unidades. Confirmar eventual custo de corte; R$105 é o custo de folhas informado, não cotação adicional de acabamento. Frentes e versos devem ter imposições correspondentes.

## Decisão pendente sobre poderes

As vinte cartas de poderes pressupõem estoque finito de cinco de cada tipo, a aprovar e implementar. A estimativa de bananas não conclui essa alteração. Sorte e azar reciclam descartes; poderes voltam ao estoque após uso; bananas permanecem com os jogadores.
