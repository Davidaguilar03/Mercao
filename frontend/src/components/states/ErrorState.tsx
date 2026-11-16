import { RefreshCw, TriangleAlert } from 'lucide-react';
import styles from './states.module.css';

interface ErrorStateProps {
  /** Spanish message for the user; the API already sends its errors in Spanish. */
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'No pudimos cargar esta información.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.state} role="alert">
      <TriangleAlert className={styles.errorIcon} size={32} aria-hidden="true" />
      <p className={styles.title}>Algo salió mal</p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  );
}
