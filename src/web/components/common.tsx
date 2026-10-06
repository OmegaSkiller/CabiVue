import { t } from '../i18n';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';
export function WarningIcon() {
  return <IconAlertTriangle size={20} className="warning-icon" aria-hidden="true" />;
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="alert alert-error" role="alert">
      <WarningIcon />
      <span>{t(error)}</span>
    </div>
  ) : null;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const previous = document.activeElement as HTMLElement;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="btn btn-ghost btn-square"
            type="button"
            aria-label={t('Close dialog')}
            onClick={onClose}
          >
            <IconX size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
