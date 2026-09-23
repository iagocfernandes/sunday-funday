import { useEffect, useRef, useState } from 'react';
import { assetFor, type Scene } from '../presentation/manifest';

interface Props {
  scene: Scene | null;
  /** Retrato do jogador da cena, sobreposto em moldura sobre a arte genérica. */
  portrait?: string;
  reducedMotion: boolean;
  muted: boolean;
  onSkip: () => void;
}

/**
 * Apresentação do livro. Terminar, pular ou falhar produz exatamente o mesmo
 * resultado: a camada visual não altera o estado do jogo.
 */
export function SceneOverlay({ scene, portrait, reducedMotion, muted, onSkip }: Props) {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => setVideoFailed(false), [scene?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Espaço pula a apresentação; nunca aciona compra ou rolagem.
      if (!scene) return;
      if (event.code === 'Space' || event.code === 'Escape') {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, onSkip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Autoplay recusado = fallback imediato para imagem.
    video.play().catch(() => setVideoFailed(true));
  }, [scene?.id, videoFailed]);

  if (!scene) return null;

  const asset = assetFor(scene.presentationKey);
  const useVideo = !!asset.video && !videoFailed && !reducedMotion;

  if (scene.level === 'small') {
    return (
      <div className="scene-overlay small" aria-live="polite">
        <div className="toast" style={{ borderColor: scene.accent }}>
          {scene.title}
          {scene.subtitle && <small>{scene.subtitle}</small>}
        </div>
      </div>
    );
  }

  return (
    <div className={`scene-overlay ${reducedMotion ? 'reduced' : ''}`} aria-live="polite">
      <div className="book-page" style={{ background: asset.gradient }}>
        <div className="media" style={{ background: asset.gradient }}>
          {useVideo ? (
            <video
              ref={videoRef}
              src={asset.video}
              muted={muted}
              playsInline
              onError={() => setVideoFailed(true)}
              onEnded={onSkip}
            />
          ) : (
            <img src={asset.image} alt="" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
          )}
          {portrait && <img className="frame" src={portrait} alt="" />}
        </div>
        <div className="caption">
          {/* Nome, retrato e valores são desenhados pela interface, não gravados na mídia. */}
          <h2 style={{ color: scene.accent ?? undefined }}>{scene.title}</h2>
          {scene.subtitle && <p>{scene.subtitle}</p>}
        </div>
      </div>
      <button className="scene-skip btn-ghost" onClick={onSkip}>
        Pular cena (Espaço)
      </button>
    </div>
  );
}
