import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { currentUserId, loadOwnSharing, setShareEverything } from '../lib/sharing.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

const LOADING = { status: 'loading', memberId: null, shareEverything: false, saving: false };

// The signed-in adult's "share everything" switch (ticket #33). Off by default: other adults
// see only a flag per day. On: they see the Week view, Calorie Log, Targets and weight.
export default function SharingSetting() {
  const { t } = useI18n();
  const [state, setState] = useState(LOADING);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    currentUserId(supabase)
      .then((userId) => (userId ? loadOwnSharing(supabase, userId) : null))
      .then((own) => {
        if (!active) return;
        if (!own) setState({ ...LOADING, status: 'none' });
        else
          setState({
            status: 'ready',
            memberId: own.memberId,
            shareEverything: own.shareEverything,
            saving: false,
          });
      })
      .catch(() => {
        if (active) setState({ ...LOADING, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleChange(event) {
    const share = event.target.checked;
    const previous = state.shareEverything;
    setError(null);
    setState((current) => ({ ...current, shareEverything: share, saving: true }));
    try {
      await setShareEverything(supabase, share);
      setState((current) => ({ ...current, saving: false }));
    } catch {
      setState((current) => ({ ...current, shareEverything: previous, saving: false }));
      setError('sharing.setting.saveError');
    }
  }

  return (
    <section aria-labelledby="sharing-setting-heading">
      <h3 id="sharing-setting-heading">{t('sharing.setting.heading')}</h3>
      {state.status === 'loading' ? <p>{t('sharing.setting.loading')}</p> : null}
      {state.status === 'none' ? <p>{t('sharing.setting.noMember')}</p> : null}
      {state.status === 'error' ? <p role="alert">{t('sharing.setting.loadError')}</p> : null}
      {state.status === 'ready' ? (
        <label>
          <input
            type="checkbox"
            checked={state.shareEverything}
            disabled={state.saving}
            onChange={handleChange}
          />{' '}
          {t('sharing.setting.label')}
        </label>
      ) : null}
      {state.status === 'ready' ? <p>{t('sharing.setting.help')}</p> : null}
      {error ? <p role="alert">{t(error)}</p> : null}
    </section>
  );
}
