import { useEffect, useRef } from 'react';

// How long a toast stays before it goes away on its own.
export const TOAST_MS = 5000;

// A short message with an optional action (Undo). It leaves after `durationMs`. The parent
// gives it a new key for each message, so each one gets the full time. The timer reads
// onDismiss through a ref, so a re-render of the parent does not restart the countdown.
export default function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = TOAST_MS,
}) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <div role="status" className="toast">
      <span>{message}</span>
      {onAction ? (
        <>
          {' '}
          <button type="button" onClick={onAction}>
            {actionLabel}
          </button>
        </>
      ) : null}
    </div>
  );
}
