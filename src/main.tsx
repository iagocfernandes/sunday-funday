import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  // StrictMode mantido de propósito: a montagem dupla em desenvolvimento
  // precisa continuar produzindo exatamente um dado, uma compra e um turno.
  <StrictMode>
    <App />
  </StrictMode>,
);
