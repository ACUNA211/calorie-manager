// The app side of the decide Edge Function (ticket 58): typed questions about a transcript,
// answered by Jev or a fallback, in one shape. Used by the Voice commands (tickets 61 to 63).

export const DECIDE_FUNCTION = 'decide';

// Error with a short code the screen maps to a message: 'cap' (AI limit), 'failed'.
export class DecideError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DecideError';
    this.code = code;
  }
}

async function errorCode(error) {
  try {
    const body = await error?.context?.json();
    return body?.code ?? null;
  } catch {
    return null;
  }
}

// Returns { provider, model, answers }. A refused call over the AI cap becomes DecideError('cap').
export async function requestDecision(client, { lang, state, questions }) {
  let response;
  try {
    response = await client.functions.invoke(DECIDE_FUNCTION, {
      body: { lang, state, questions },
    });
  } catch {
    throw new DecideError('failed');
  }
  const { data, error } = response ?? {};
  if (error) {
    const code = await errorCode(error);
    throw new DecideError(code === 'AI_LIMIT_REACHED' ? 'cap' : 'failed');
  }
  if (!data || typeof data.answers !== 'object' || data.answers === null) {
    throw new DecideError('failed');
  }
  return data;
}
