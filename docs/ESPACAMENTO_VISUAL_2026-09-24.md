# Espaçamento visual do tabuleiro v5 — 24/09/2026

Helper isolado em `src/presentation/boardLayout.ts`.

## Uso

```ts
const renderMap = layoutBoardForRender(state.map);
```

`layoutBoardForRender` só reamostra `ilha-dos-gorilas-v5`. Mapas v4 e legados retornam a mesma referência, preservando saves antigos. O helper é para renderização: não deve ser salvo no estado nem substituir `createDefaultMap`.

## Algoritmo

- Usa a escala real do SVG, 1000×563, para medir comprimento.
- Divide o grafo v5 entre âncoras: início `m0`, bifurcações `m4`/`m16` e reencontros `m9`/`m22`.
- Mantém as polilinhas já desenhadas (incluindo cada nó intermediário) e reamostra os nós por comprimento acumulado. Assim, os pontos seguem as curvas existentes e não recebem atalhos sobre água.
- Mantém cada `id`, `kind` e `next`. Os `from`/`to` das paradas e `artX`/`artY` também permanecem; apenas `x`/`y` do piso são projetados novamente sobre a mesma aresta.
- Retorna um novo `BoardMap` somente no v5, sem mutar o mapa de origem.

## Medição

Medida nas 50 arestas dirigidas do mapa v5, em pixels de 1000×563:

| Estado | Mínimo | Máximo | Média | CV |
|---|---:|---:|---:|---:|
| Antes | 32,24 px | 76,30 px | 49,61 px | 0,254 |
| Depois | 44,11 px | 53,90 px | 49,32 px | 0,050 |

O teste `src/presentation/boardLayout.test.ts` confirma redução do intervalo e do coeficiente de variação, equivalência lógica e pisos sobre as arestas.

## Limite conhecido

A uniformidade é por trecho entre âncoras. Os sete trechos têm comprimentos e quantidades de casas diferentes, especialmente nas duas ramificações; portanto, não há promessa de uma distância global única. O helper também não redesenha o cenário: se a arte final mover uma trilha, é preciso atualizar o mapa canônico e então reavaliar o layout.
