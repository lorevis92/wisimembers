import React from 'react';
import { api } from '../lib/api.js';
import { Logo } from './ui.jsx';

async function signOutAndReload() {
  try {
    await api.signOut();
  } catch {
    // si ricarica comunque
  }
  window.location.reload();
}

/** Riquadro d'errore a tutta pagina: messaggio leggibile e via d'uscita, al posto dello schermo bianco. */
export function ErrorCard({ title = 'Qualcosa è andato storto', lead, message, details, onRetry }) {
  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <h1>{title}</h1>
        <p className="lead">{lead || "L'app ha incontrato un errore e si è fermata. Il messaggio qui sotto aiuta a capire cosa è successo."}</p>
        <pre className="errbox">{message || 'Errore sconosciuto.'}</pre>
        {details && (
          <>
            <div className="errlabel">Dettagli tecnici</div>
            <pre className="errbox details">{details}</pre>
          </>
        )}
        <div className="acts">
          {onRetry && <button className="btn" onClick={onRetry}>Riprova</button>}
          <button className={onRetry ? 'btn ghost' : 'btn'} onClick={signOutAndReload}>Esci e riprova</button>
        </div>
      </div>
    </div>
  );
}

/** Raccoglie gli errori di rendering e degli effetti di tutta l'app. */
export default class ErrorBoundary extends React.Component {
  state = { error: null, componentStack: '' };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app]', error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack || '' });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    const details = [
      error?.stack && `Stack:\n${error.stack}`,
      componentStack && `Componenti:${componentStack}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    return <ErrorCard message={String(error?.message || error)} details={details} />;
  }
}
