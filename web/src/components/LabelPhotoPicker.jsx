import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { LabelPhotoError, labelPhotoToFormValues } from '../lib/labelPhoto.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

const ERROR_KEYS = {
  cap: 'labelPhoto.cap',
  unreadable: 'labelPhoto.unreadable',
  badPhoto: 'labelPhoto.badPhoto',
};

// "Take a photo of the label" (ticket 66). Opens the phone camera, reads the label and hands
// the values to onValues, which pre-fills the label form. Saves nothing itself.
export default function LabelPhotoPicker({ onValues }) {
  const { t } = useI18n();
  const units = useUnits();
  const input = useRef(null);
  // null, 'reading', 'done' or an error code
  const [status, setStatus] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus('reading');
    try {
      const values = await labelPhotoToFormValues(supabase, file, units.units);
      onValues(values);
      setStatus('done');
    } catch (error) {
      setStatus(error instanceof LabelPhotoError ? error.code : 'failed');
    }
  }

  const busy = status === 'reading';
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label={t('labelPhoto.fileLabel')}
        onChange={handleFile}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? t('labelPhoto.reading') : t('labelPhoto.take')}
      </button>
      {status === 'done' && <p role="status">{t('labelPhoto.done')}</p>}
      {status && status !== 'reading' && status !== 'done' && (
        <p role="alert">{t(ERROR_KEYS[status] ?? 'labelPhoto.failed')}</p>
      )}
    </div>
  );
}
