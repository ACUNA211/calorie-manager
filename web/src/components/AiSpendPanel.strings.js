// Text for AiSpendPanel. Ticket 04 moves these into en.json and es.json.

export const AI_SPEND_TEXT = {
  heading: 'AI spend this month',
  loading: 'Loading AI spend…',
  loadError: 'Could not load AI spend. Only the Owner can see it.',
  noSpend: 'No AI calls this month yet.',
  columns: {
    provider: 'Provider',
    spent: 'Spent',
    cap: 'Monthly cap',
    status: 'Status',
  },
  status: {
    ok: 'Under the cap',
    limit: 'AI limit reached this month',
  },
  providers: {
    anthropic: 'Anthropic (Claude)',
    typesafe: 'TypeSafe (Jev)',
    google: 'Google',
    openai: 'OpenAI',
  },
};
