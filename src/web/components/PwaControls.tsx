import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { IconDownload, IconRefresh } from '@tabler/icons-react';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let update: ((reloadPage?: boolean) => Promise<void>) | undefined;
let notifyUpdate: (() => void) | undefined;
if (import.meta.env.PROD)
  update = registerSW({
    onNeedRefresh() {
      notifyUpdate?.();
    },
  });
export function PwaControls({ blocked }: { blocked: boolean }) {
  const [available, setAvailable] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    notifyUpdate = () => setAvailable(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      notifyUpdate = undefined;
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);
  return (
    <>
      {available && (
        <div className="alert update-alert" role="status">
          <IconRefresh size={22} />
          <div>
            <strong>A new Cabivue version is ready</strong>
            <p>
              {blocked
                ? 'Finish or discard your edits, scan review, or interview before updating.'
                : 'Reload when you’re ready.'}
            </p>
            <button
              className="btn btn-primary"
              disabled={blocked}
              onClick={() => void update?.(true)}
            >
              Update & reload
            </button>
          </div>
        </div>
      )}
      {install && (
        <button
          className="btn btn-outline install-button"
          onClick={async () => {
            await install.prompt();
            await install.userChoice;
            setInstall(null);
          }}
        >
          <IconDownload size={19} />
          Install Cabivue
        </button>
      )}
    </>
  );
}
