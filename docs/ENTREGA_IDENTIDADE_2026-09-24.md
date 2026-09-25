# Sunday Funday — integração da identidade e apresentação

## Direção executada
Tropical adulto: títulos sans muito pesados, creme/carvão/amarelo, cores funcionais teal/verde/coral/roxo. Referência aprovada em `public/assets/references/direcao-tropical-bold.png`. A composição gerada é referência de identidade, não substitui a ilha nem suas rotas.

## Integrado ao código
- Interface TV/celular, botões, saldos, placar compacto para 10 jogadores e revelação digital de Sorte/Azar.
- Seis artes originais de poderes em um sprite 3×2; PowerCard/PowerArt reutilizados na galeria, loja, escolha e inventário. Nomes, custos e efeitos vêm do catálogo real.
- Retratos oficiais com enquadramento facial. Fotos dos jogadores preservadas; defaults antigos são remapeados apenas na apresentação, sem reescrever saves.
- Ícones vetoriais próprios para moedas, banana, sorte e azar.
- 48 casas com redistribuição visual ao longo das rotas existentes; IDs, bifurcações, efeitos e saves preservados.
- Fila visual de deslocamento: três passos recebidos juntos aparecem como três saltos. Câmera segue a posição visual; HUD/comandos usam o estado canônico.
- Ilha viva opcional: movimento sutil de copas, corrente nas cachoeiras e ondulações localizadas. Pausa, aba oculta e movimento reduzido respeitados.
- Áudio Web Audio original: oito tipos de efeitos e loop ambiente sintético, ativados por gesto no menu da TV. Mute, música e volumes separados. Sem reprodução de histórico ao reconectar.

## Validação
- `npm run build`: passou (TypeScript cliente/servidor e bundle).
- `npm test`: 228 testes passaram em 18 arquivos.
- Navegador: 48 casas, 10 jogadores, zero saldos cortados em viewport 1280px.
- Navegador: observados jump/land em três coordenadas sucessivas para atualização com três passos.
- Navegador: áudio ativado por botão, volumes 0,20/0,55; controles disponíveis.
- Navegador: evento de Sorte apareceu e fechou automaticamente após sete segundos.
- Navegador: compra por 10 moedas, saldo 28 → 18, descarte exigido com mão cheia e três poderes após compra.
- Viewport móvel 390×844: largura de documento 390, rolagem vertical verificada; não é validação física de Safari/iPhone.

## Como testar
Servidor local: `http://localhost:5193/design/` → Tabuleiro real. A demonstração usa os componentes de produção e o motor local, isolada de salas reais. Botões: TV, celular, três passos, loja, sorte, azar, duelo. Menu TV: ilha viva e áudio.

## Limites e refinamentos restantes
Alterações locais, sem publicação Vercel nesta rodada. Música é síntese provisória, não trilha final. Eventos têm moldura/tipografia próprias, mas ainda não ilustrações narrativas individuais para cada uma das 13 cartas. Ilha viva é uma composição leve sobre imagem estática, não vídeo/3D nem água fisicamente simulada. Validar a experiência no aparelho e TV reais antes de publicar. A rota `/design/` é ferramenta de desenvolvimento, não faz parte do build público atual.
