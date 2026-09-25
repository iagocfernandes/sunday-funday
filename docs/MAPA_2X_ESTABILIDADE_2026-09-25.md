# Mapa ampliado e estabilidade na TV

- Original preservado: public/assets/board/ilha-v4.png (1672×941).
- Novo fundo e recortes animados: ilha-v4-2x.webp (3344×1882, 1.33 MiB).
- Ampliação convencional Lanczos 2×, nitidez leve (radius 1, percent 15, threshold 3), WebP qualidade 95. Script scripts/upscale-board.py.
- Composição, coordenadas, topologia e regras inalteradas. Não é reconstrução de detalhe por IA.

## Piscar das casas

Removidas promoções permanentes de camadas (`will-change`) na câmera e nos recortes de água/copas; removidos `mix-blend-mode: screen` e `isolation` do ambiente. Animações e máscaras preservadas.

Causa provável: custo de composição das múltiplas imagens SVG de mapa inteiro, somado à câmera. Não reproduzido no desktop; confirmação requer o equipamento do usuário. Não afirmar causa definitivamente comprovada.

Validação: 297 testes passaram; build client/server passou; prévia com 48 casas visíveis e novo asset carregado. Sem alterações de partidas salvas.
