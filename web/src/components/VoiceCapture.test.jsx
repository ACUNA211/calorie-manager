import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import { LOCALE_KEY } from '../i18n/locale.js';
import VoiceCapture from './VoiceCapture.jsx';

let instances;
class FakeRecognition {
  constructor() {
    this.started = false;
    instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
  }
}
const heard = (rec, parts) =>
  act(() => {
    const results = parts.map(([transcript, isFinal]) =>
      Object.assign([{ transcript }], { isFinal })
    );
    rec.onresult({ results });
  });

function renderIn(locale = 'en') {
  window.localStorage.setItem(LOCALE_KEY, locale);
  return render(
    <I18nProvider>
      <VoiceCapture />
    </I18nProvider>
  );
}

describe('VoiceCapture', () => {
  beforeEach(() => {
    instances = [];
    window.SpeechRecognition = FakeRecognition;
  });
  afterEach(() => {
    cleanup();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    window.localStorage.clear();
  });

  it('hides the mic where speech recognition is missing', () => {
    delete window.SpeechRecognition;
    const { container } = renderIn();
    expect(container).toBeEmptyDOMElement();
  });

  it('works with the webkit-prefixed constructor', async () => {
    delete window.SpeechRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    renderIn();
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(instances[0].started).toBe(true);
  });

  it('listens in English and shows interim then final words', async () => {
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(instances[0].lang).toBe('en-US');
    heard(instances[0], [['two eggs', false]]);
    expect(screen.getByText('two eggs')).toBeInTheDocument();
    heard(instances[0], [['two eggs and toast', true]]);
    act(() => instances[0].onend());
    expect(screen.getByText('two eggs and toast')).toBeInTheDocument();
  });

  it('listens in Spanish', async () => {
    renderIn('es');
    await userEvent.click(screen.getByRole('button', { name: /hablar/i }));
    expect(instances[0].lang).toBe('es-MX');
    heard(instances[0], [['dos huevos', true]]);
    expect(screen.getByText('dos huevos')).toBeInTheDocument();
  });

  it('Retry clears the transcript and listens again', async () => {
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    heard(instances[0], [['milk', true]]);
    act(() => instances[0].onend());
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.queryByText('milk')).not.toBeInTheDocument();
    expect(instances).toHaveLength(2);
    expect(instances[1].started).toBe(true);
  });

  it('explains a denied microphone', async () => {
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    act(() => instances[0].onerror({ error: 'not-allowed' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/microphone/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('explains when no speech was heard', async () => {
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    act(() => {
      instances[0].onerror({ error: 'no-speech' });
      instances[0].onend();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/hear anything/i);
  });
});
