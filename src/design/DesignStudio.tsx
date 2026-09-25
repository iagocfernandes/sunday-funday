import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PowerCard } from '../components/PowerCard';
import { DEFAULT_CONFIG } from '../data/config';
import { GameplayPreview } from './GameplayPreview';
import '../styles/app.css';
import '../remote/remote.css';
import './studio.css';

const POWER_IDS = DEFAULT_CONFIG.shopItems;

function DirectionView() {
  return (
    <div className="direction-view">
      <section className="direction-hero">
        <div className="hero-copy">
          <span className="eyebrow">DIREÇÃO APROVADA · IDENTIDADE VISUAL</span>
          <h1>Sunday Funday com impacto de festa.</h1>
          <p>Ultra bold sans, creme/preto/amarelo e teal, verde e coral para estados funcionais. Os gorilas oficiais mantêm o realismo estilizado; a ilha aprovada continua sendo o cenário.</p>
          <div className="direction-tags"><span>ULTRA BOLD</span><span>CREME / PRETO / AMARELO</span><span>TEAL · VERDE · CORAL</span></div>
          <p className="direction-note">A prévia define a linguagem visual. Ela não altera a topologia nem redesenha o tabuleiro.</p>
        </div>
        <figure className="direction-image approved-preview">
          <img src="/assets/references/direcao-tropical-bold.png" alt="Prévia aprovada da direção tropical bold" />
          <figcaption>Prévia local aprovada · direção tropical bold</figcaption>
        </figure>
      </section>

      <section className="official-reference">
        <div>
          <span className="eyebrow">FONTE OFICIAL DOS PERSONAGENS</span>
          <h2>Gorilas dourados 3D estilizados</h2>
          <p>Materiais realistas, pelo mel, metal envelhecido, couro marrom e tecido vinho. Esta referência substitui as propostas antigas e os retratos genéricos como fonte para novos assets.</p>
          <span className="status ready">✓ referência recebida</span>
        </div>
        <img src="/assets/references/personagens-oficiais.png" alt="Arthur, Mari e Milena na referência oficial" />
      </section>

      <section className="miguel-gallery component-section">
        <div className="section-heading"><div><span className="eyebrow">MIGUEL · ANFITRIÃO DA ILHA</span><h2>Ele comemora. Ele provoca. Ele sente.</h2></div></div>
        <div className="miguel-moods">{[['0% 0%','Na área'],['100% 0%','Comemorando'],['0% 100%','Aprontando'],['100% 100%','Fique sóbrio…']].map(([position,label])=><article key={label}><div style={{backgroundPosition:position}}/><strong>{label}</strong></article>)}</div>
        <p>Comentários contextuais e voz opcional. Durante Fique Sóbrio, a expressão triste dura até o efeito acabar.</p>
      </section>
      <section className="component-section">
        <div className="section-heading"><div><span className="eyebrow">CATÁLOGO REAL DO APP</span><h2>Seis poderes da loja</h2></div><span className="status ready">✓ nomes e descrições fonte</span></div>
        <div className="power-grid">{POWER_IDS.map(itemId => <PowerCard key={itemId} itemId={itemId} />)}</div>
      </section>

      <section className="readiness">
        <div className="section-heading"><div><span className="eyebrow">INVENTÁRIO HONESTO</span><h2>Entrega real e próximos refinamentos</h2></div></div>
        <div className="readiness-grid">
          <div className="readiness-card ready-card"><b>PRONTO</b><span>Tabuleiro TV 48</span><small>Layout, movimento, LivingIsland e áudio integrados no BoardTv.</small></div>
          <div className="readiness-card ready-card"><b>PRONTO</b><span>Poderes e ícones nativos</span><small>6 artes no PowerCard/PowerArt; moeda, banana, Sorte e Azar em GameIcon.</small></div>
          <div className="readiness-card ready-card"><b>PRONTO</b><span>Retratos oficiais</span><small>Arthur, Mari e Milena em PlayerPortrait com enquadramento CSS; defaults antigos só mapeiam visualmente.</small></div>
          <div className="readiness-card ready-card"><b>PRONTO</b><span>GameplayPreview local</span><small>Motor real com 10 jogadores, loja, duelo, eventos e simulação de 3 passos.</small></div>
          <div className="readiness-card pending-card"><b>PENDENTE</b><span>Refino artístico dos 13 eventos</span><small>A interface funciona; faltam ilustrações individuais de maior acabamento.</small></div>
          <div className="readiness-card pending-card"><b>PENDENTE</b><span>Trilha musical final</span><small>Novo arranjo original com marimba, baixo, harmonia e percussão. Refinamento final após ouvir na TV.</small></div>
          <div className="readiness-card pending-card"><b>PENDENTE</b><span>Filme/cinemagraphs</span><small>Recortes limpos para efeitos cinematográficos são opcionais para elevar a qualidade.</small></div>
          <div className="readiness-card pending-card"><b>PENDENTE</b><span>QA e publicação</span><small>Falta validar em aparelho real e publicar a versão final.</small></div>
        </div>
      </section>
    </div>
  );
}

function Studio() {
  const [selected, setSelected] = useState<'direction' | 'map'>(()=>new URLSearchParams(location.search).get('tab')==='game'?'map':'direction');
  return (
    <main className="studio">
      <nav>
        <div><strong>SUNDAY FUNDAY</strong><span>Design Studio · prévia local</span></div>
        <div className="studio-tabs">
          <button className={selected === 'direction' ? 'active' : ''} onClick={() => setSelected('direction')}>Direção aprovada</button>
          <button className={selected === 'map' ? 'active' : ''} onClick={() => setSelected('map')}>Tabuleiro real</button>
        </div>
      </nav>
      {selected === 'direction' ? <DirectionView /> : <div className="studio-board"><GameplayPreview /></div>}
      <footer>Studio local sem APIs externas. A aba Tabuleiro real usa a prévia GameplayPreview com o motor e os componentes reais.</footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Studio />);
