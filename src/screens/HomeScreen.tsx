import { useRef, useState } from 'react';
import { loadSnapshotDetailed, parseImport, type Snapshot } from '../persistence/storage';

interface Props {
  onNewGame: () => void;
  onDemo: () => void;
  onContinue: (snapshot: Snapshot) => void;
  onImport: (snapshot: Snapshot) => void;
}

export function HomeScreen({ onNewGame, onDemo, onContinue, onImport }: Props) {
  const load = loadSnapshotDetailed();
  const saved = load?.snapshot ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="home">
      <div className="home-card">
        <h1>SUNDAY FUNDAY</h1>
        <div className="date">27 / 09</div>

        <div className="home-actions">
          {saved && (
            <button className="btn-primary" onClick={() => onContinue(saved)}>
              Continuar partida
              <div style={{ fontSize: '0.72rem', fontWeight: 400 }}>
                Rodada {saved.state.round} · {new Date(saved.savedAt).toLocaleString('pt-BR')}
              </div>
            </button>
          )}
          <button className={saved ? '' : 'btn-primary'} onClick={onNewGame}>Nova partida</button>
          <button onClick={() => fileRef.current?.click()}>Importar backup</button>
          <button onClick={onDemo}>Demonstração (8 gorilas)</button>
          <a href="/?remote=tv" style={{ textAlign: 'center', padding: '0.8rem' }}>Teste: controles pelo celular</a>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const result = parseImport(await file.text());
            // Arquivo inválido não destrói a partida atual.
            if (!result.ok) setError(result.error);
            else { setError(null); onImport(result.snapshot); }
          }}
        />

        {load?.origin === 'previous' && (
          <div className="notice-bar" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            O último estado salvo estava corrompido ({load.recoveredFrom}). Foi recuperado o
            estado imediatamente anterior — confira os saldos antes de retomar.
          </div>
        )}

        {error && (
          <div className="notice-bar error-bar" style={{ marginTop: '1rem', justifyContent: 'center' }}>
            Importação recusada: {error}
          </div>
        )}

        <div className="home-meta">
          <span>👥 8 – 10 jogadores</span>
          <span>🎲 1 minigame por rodada</span>
          <span>💻 Tudo roda neste computador</span>
        </div>

        <p style={{ color: 'var(--ink-dim)', marginTop: '2rem', fontSize: '0.88rem' }}>
          Modo demonstração permite verificar o fluxo completo sem baralho físico
          e sem realizar provas reais: decisões e resultados são informados manualmente.
        </p>
      </div>
    </div>
  );
}
