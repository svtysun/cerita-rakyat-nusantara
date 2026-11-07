import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import './styles/global.css';
import './styles/flip.css';
import './styles/editor.css';
import './styles/fun.css';

createRoot(document.getElementById('root')!).render(
  <ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider>,
);
