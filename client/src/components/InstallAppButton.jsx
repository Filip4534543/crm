import { useEffect, useState } from 'react';
import {
  isStandaloneApp,
  promptInstall,
  subscribeInstallPrompt,
} from '../pwa';

export default function InstallAppButton({ variant = 'header' }) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneApp);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (isStandaloneApp()) {
      setInstalled(true);
      return undefined;
    }

    return subscribeInstallPrompt((event) => {
      setCanPrompt(Boolean(event));
    });
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (canPrompt) {
      const { outcome } = await promptInstall();
      if (outcome === 'accepted') setInstalled(true);
      setHint(false);
      return;
    }
    setHint((open) => !open);
  }

  return (
    <div className={`install-app${variant === 'login' ? ' install-app-login' : ''}`}>
      <button
        type="button"
        className={variant === 'login' ? 'btn-ghost install-app-btn' : 'btn-ghost'}
        onClick={handleClick}
        title="Zainstaluj aplikację na komputerze"
      >
        Pobierz aplikację
      </button>
      {hint && (
        <p className="install-app-hint">
          W Chrome kliknij ikonę instalacji w pasku adresu albo menu ⋮ → Zainstaluj Filip's CRM.
        </p>
      )}
    </div>
  );
}
