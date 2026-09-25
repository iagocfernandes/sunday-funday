# Voz oficial do anfitrião

Decisão do usuário em 25/09/2026: o anfitrião se chama AR2, substituindo Miguel.

- Nome em textos e interface: **AR2**.
- Grafia fonética nos textos enviados à geração de voz: **Arrrr tchuuu** (preservar exatamente).
- Referência aprovada: `public/assets/audio/ar2/referencia-aprovada.wav`.
- Origem: Google AI Studio, arquivo “Generated Audio September 25, 2026 - 2_29AM.wav”.
- A aprovação é do áudio fornecido. Não presumir que configurações anteriores do AI Studio reproduzem exatamente essa versão.

## Integração local

A TV usa arquivos WAV gravados, sem gerar voz durante a partida e sem síntese do navegador.
Catálogo: `src/presentation/hostAudioCues.ts`. Oito eventos disponíveis: abertura, banana comprada, banana roubada, última rodada, campeão, sorte, azar e fique sóbrio.

As falas suspendem a progressão no servidor e os controles dos celulares. A conclusão do áudio ou o botão Pular fala libera a partida; erro, autoplay bloqueado, mute e timeout também liberam. A pausa manual continua independente. Música reduzida durante a narração. O botão de início prepara o elemento de áudio no gesto do anfitrião.

Duelo e vitória do minigame ainda aguardam identificação dos respectivos arquivos. Não reutilizar a fala de campeão no minigame. O arquivo gerado às 2:59 permanece sem associação até confirmação do usuário.

Prévia: `/design/?tab=game` (somente desenvolvimento). Produção requer publicar esta versão.
