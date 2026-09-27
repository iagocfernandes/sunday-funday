import { useState } from 'react';
import { MiguelHostView } from '../components/MiguelHost';
import { hostVideoForMood } from '../presentation/hostVideoClips';
import type { HostAudioClip, HostAudioMood } from '../presentation/hostAudioCues';
import './host-preview.css';

const MOMENTS: { name: string; mood: HostAudioMood; clip: HostAudioClip; text: string }[] = [
  { name: 'Na área', mood: 'neutral', clip: 'opening', text: 'Gorilada, comigo! Cada um no seu celular. A amizade a gente resolve depois.' },
  { name: 'Banana dourada', mood: 'happy', clip: 'bananaBought', text: 'A árvore do Fábio deu bom. Guarda essa banana, que tem gorila de olho!' },
  { name: 'Deu ruim', mood: 'mischievous', clip: 'unluck', text: 'Eu avisei que a ilha tinha senso de humor. Só não disse com quem.' },
  { name: 'Fique sóbrio', mood: 'sad', clip: 'sober', text: 'Um minuto de silêncio pela bananinha. Hoje o brinde é com água.' },
  { name: 'Campeão', mood: 'happy', clip: 'champion', text: 'Respeita o gorila! Hoje a banana tem dono.' },
];

export function HostPreview() {
  const [index, setIndex] = useState(0);
  const [take, setTake] = useState(0);
  const [paused, setPaused] = useState(false);
  const moment = MOMENTS[index];
  const video = hostVideoForMood(moment.mood, moment.clip);
  return <section className="host-preview">
    <header><span className="eyebrow">AR2 · DIREÇÃO E ATUAÇÃO</span><h1>A ilha tem um anfitrião.</h1><p>Reações curtas, humor entre amigos e a voz que você já aprovou.</p></header>
    <div className="host-preview__tabs">{MOMENTS.map((item, i) => <button key={item.clip} aria-pressed={index === i} onClick={() => { setIndex(i); setTake(t => t + 1); setPaused(false); }}>{item.name}</button>)}</div>
    <div className="host-preview__stage">
      <MiguelHostView enabled announcement paused={paused} videoClip={moment.clip} reaction={{ messageId: `preview-${moment.clip}-${take}`, mood: moment.mood, text: moment.text, visible: true, dismiss: () => setPaused(true) }} className="host-preview__actor" />
    </div>
    <div className="host-preview__controls"><button onClick={() => { setTake(t => t + 1); setPaused(false); }}>Repetir reação</button><button aria-pressed={paused} onClick={() => { if (paused) setTake(t => t + 1); setPaused(p => !p); }}>{paused ? 'Recomeçar' : 'Pausar'}</button><span>{video ? 'Vídeo gerado no Gemini · prévia sem áudio' : 'Expressão aprovada · vídeo pendente de geração'}</span></div>
    {moment.clip === 'champion' && <p>A comemoração reutiliza o vídeo da banana enquanto a cena exclusiva de campeão aguarda geração.</p>}
    <p>As frases desta prévia são propostas. Na partida, os nomes e instruções seguem o estado real; os áudios gravados continuam conduzindo os grandes momentos.</p>
  </section>;
}
