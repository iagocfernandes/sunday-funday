import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';

const RemoteApp = lazy(() => import('./remote/RemoteApp'));
const localMode = new URLSearchParams(location.search).get('mode') === 'local';

createRoot(document.getElementById('root')!).render(
  // StrictMode mantido de propósito: a montagem dupla em desenvolvimento
  // precisa continuar produzindo exatamente um dado, uma compra e um turno.
  <StrictMode>
    {localMode ? <App /> : <Suspense fallback={<p>Conectando…</p>}><RemoteApp /></Suspense>}
  </StrictMode>,
);
