import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { requestDecision } from '../lib/decide.js';
import { candidateLines, shoppingCards, shoppingQuestions } from '../lib/voiceShopping.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import VoiceCapture from './VoiceCapture.jsx';

// Voice commands on the Shopping list (ticket 61): "tick off the milk", "add bread". The words
// go to the decide function with the open, unticked lines as choices; the three likeliest
// meanings show as option cards. Nothing changes until the Member taps a card; if none is right
// they say it again. Needs a connection, so with no signal it only says so.
// `onTick(line)` ticks a line Bought and `onAdd(fields)` adds a hand line; both come from the page.
export default function ShoppingVoice({ lines, online, onTick, onAdd }) {
  const { t, locale } = useI18n();
  // { status: 'idle' | 'deciding' | 'cards' | 'none' | 'error' | 'applied', cards, message }
  const [result, setResult] = useState({ status: 'idle', cards: [], message: null });

  const clear = useCallback(() => setResult({ status: 'idle', cards: [], message: null }), []);

  const decideOn = useCallback(
    async (transcript) => {
      const candidates = candidateLines(lines, transcript);
      setResult({ status: 'deciding', cards: [], message: null });
      try {
        const { answers } = await requestDecision(supabase, {
          lang: locale,
          state: transcript,
          questions: shoppingQuestions(candidates),
        });
        const cards = shoppingCards(answers, candidates, transcript);
        setResult({ status: cards.length > 0 ? 'cards' : 'none', cards, message: null });
      } catch (error) {
        setResult({
          status: 'error',
          cards: [],
          message: error?.code === 'cap' ? 'voice.shopping.cap' : 'voice.shopping.failed',
        });
      }
    },
    [lines, locale]
  );

  async function choose(card) {
    setResult({ status: 'deciding', cards: [], message: null });
    try {
      if (card.kind === 'tick') {
        const ok = await onTick(card.line);
        setResult({
          status: ok ? 'applied' : 'error',
          cards: [],
          message: ok ? null : 'voice.shopping.failed',
        });
      } else {
        const outcome = await onAdd({
          name: card.name,
          foodId: null,
          grams: null,
          text: card.text,
        });
        setResult({
          status: 'applied',
          cards: [],
          message: outcome?.queued ? 'shopping.add.queued' : 'shopping.add.added',
          name: card.name,
        });
      }
    } catch {
      setResult({ status: 'error', cards: [], message: 'voice.shopping.failed' });
    }
  }

  if (!online) return <p className="small mute">{t('voice.shopping.offline')}</p>;

  return (
    <VoiceCapture onHeard={decideOn} onListen={clear}>
      {result.status === 'deciding' ? (
        <p className="small mute">{t('voice.shopping.deciding')}</p>
      ) : null}
      {result.status === 'none' ? <p className="small">{t('voice.shopping.none')}</p> : null}
      {result.status === 'error' ? <p role="alert">{t(result.message)}</p> : null}
      {result.status === 'applied' && result.message ? (
        <p className="small">{t(result.message, { name: result.name })}</p>
      ) : null}
      {result.status === 'cards' ? (
        <div className="voice-cards" role="group" aria-label={t('voice.shopping.cardsLabel')}>
          <p className="small mute">{t('voice.shopping.pick')}</p>
          {result.cards.map((card) => (
            <button
              type="button"
              className="voice-card"
              key={card.kind === 'tick' ? `tick-${card.line.id}` : `add-${card.name}`}
              onClick={() => choose(card)}
            >
              {card.kind === 'tick'
                ? t('voice.shopping.tickCard', { name: card.line.name })
                : card.text
                  ? t('voice.shopping.addCardAmount', { name: card.name, amount: card.text })
                  : t('voice.shopping.addCard', { name: card.name })}
            </button>
          ))}
        </div>
      ) : null}
    </VoiceCapture>
  );
}
