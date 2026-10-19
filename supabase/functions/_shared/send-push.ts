// Send a push notification to a Member's devices (ticket #54). Thin Edge Function wrapper:
// ../send-push/index.ts. Two kinds of caller:
//   - A signed-in Member (the "Send test" button): the notification goes to that Member's own
//     devices only, whoever they name in the request.
//   - A trusted server caller holding the service-role key (the weekly draft and reminders,
//     tickets 55 and 56): the notification goes to the Members named in `memberIds`.
// A device the push service reports as gone (404 or 410) is deleted from push_subscriptions.
//
// Secrets: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY and VAPID_SUBJECT (set by the Owner with
// `supabase secrets set`). The private key is read here from the env only.

import { sendWebPush, type PushTarget, type VapidKeys } from './web-push.ts';

export const MAX_TITLE_CHARS = 100;
export const MAX_BODY_CHARS = 300;
export const MAX_RECIPIENTS = 50;

export type PushOutcome = 'sent' | 'gone' | 'failed';

// What a push service's HTTP status means for the stored subscription: 201 (or any 2xx) was
// accepted; 404 and 410 mean the device unsubscribed or the subscription expired, so the row is
// removed; anything else (429, 5xx, 400, 401, 403) is a failure that keeps the row, because the
// subscription may still be good and a bad VAPID key would otherwise wipe every device.
export function classifyPushStatus(status: number): PushOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'gone';
  return 'failed';
}

export interface PushRow extends PushTarget {
  id: number;
  member_id: number;
}

export interface PushSummary {
  sent: number;
  removed: number;
  failed: number;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// Sends the message to each row and returns the totals and the ids to delete. A thrown error
// (no network) counts as failed and keeps the row.
export async function deliver(
  rows: PushRow[],
  message: PushMessage,
  send: (target: PushTarget, payload: string) => Promise<number>
): Promise<{ summary: PushSummary; goneIds: number[] }> {
  const payload = JSON.stringify(message);
  const summary: PushSummary = { sent: 0, removed: 0, failed: 0 };
  const goneIds: number[] = [];
  const outcomes = await Promise.all(
    rows.map(async (row): Promise<PushOutcome> => {
      try {
        return classifyPushStatus(await send(row, payload));
      } catch {
        return 'failed';
      }
    })
  );
  outcomes.forEach((outcome, i) => {
    if (outcome === 'sent') summary.sent += 1;
    else if (outcome === 'gone') {
      summary.removed += 1;
      goneIds.push(rows[i].id);
    } else summary.failed += 1;
  });
  return { summary, goneIds };
}

// Validates the request body. Returns the message and recipients, or an error text.
export function readRequest(
  body: unknown
): { message: PushMessage; memberIds: number[] } | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Send the notification as JSON.' };
  }
  const input = body as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const text = typeof input.body === 'string' ? input.body.trim() : '';
  if (title === '' || title.length > MAX_TITLE_CHARS) {
    return { error: `Give a title of 1 to ${MAX_TITLE_CHARS} characters.` };
  }
  if (text === '' || text.length > MAX_BODY_CHARS) {
    return { error: `Give a message of 1 to ${MAX_BODY_CHARS} characters.` };
  }
  // Only an app path: the notification opens the app, never another site.
  const url = typeof input.url === 'string' && /^\/(?!\/)/.test(input.url) ? input.url : '/';
  const tag = typeof input.tag === 'string' ? input.tag.slice(0, 64) : undefined;
  const ids = Array.isArray(input.memberIds)
    ? input.memberIds.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
  return {
    message: { title, body: text, url, ...(tag ? { tag } : {}) },
    memberIds: [...new Set(ids)].slice(0, MAX_RECIPIENTS),
  };
}

// The subset of the supabase-js clients this handler uses.
// deno-lint-ignore no-explicit-any
export type PushClient = { from: (table: string) => any; auth?: any };

export interface SendPushDeps {
  userClient: PushClient;
  serviceClient: PushClient;
  serviceRoleKey: string;
  vapid: VapidKeys | null;
  send?: (target: PushTarget, payload: string, vapid: VapidKeys) => Promise<number>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Reads the VAPID settings from the environment. Null when any is missing.
export function vapidFromEnv(get: (name: string) => string | undefined): VapidKeys | null {
  const publicKey = get('VAPID_PUBLIC_KEY');
  const privateKey = get('VAPID_PRIVATE_KEY');
  const subject = get('VAPID_SUBJECT');
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export async function handleSendPush(req: Request, deps: SendPushDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return jsonResponse(405, {
      code: 'METHOD_NOT_ALLOWED',
      error: 'Use POST.',
    });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token === '') return jsonResponse(401, { code: 'UNAUTHORIZED', error: 'Sign in first.' });
  const trusted = deps.serviceRoleKey !== '' && token === deps.serviceRoleKey;

  let ownMemberId: number | null = null;
  if (!trusted) {
    const { data: userData, error: userError } = await deps.userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(401, {
        code: 'UNAUTHORIZED',
        error: 'Sign in first.',
      });
    }
    const { data: member, error: memberError } = await deps.userClient
      .from('members')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (memberError || !member) {
      return jsonResponse(403, {
        code: 'NO_HOUSEHOLD',
        error: 'Create or join a Household first.',
      });
    }
    ownMemberId = member.id;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, {
      code: 'BAD_REQUEST',
      error: 'Send the notification as JSON.',
    });
  }
  const parsed = readRequest(body);
  if ('error' in parsed) return jsonResponse(400, { code: 'BAD_REQUEST', error: parsed.error });

  const memberIds = trusted ? parsed.memberIds : ownMemberId === null ? [] : [ownMemberId];
  if (memberIds.length === 0) {
    return jsonResponse(400, {
      code: 'NO_RECIPIENTS',
      error: 'Name at least one Member.',
    });
  }

  if (!deps.vapid) {
    return jsonResponse(500, {
      code: 'NOT_CONFIGURED',
      error: 'The push keys are not set on the server.',
    });
  }
  const vapid = deps.vapid;

  const { data: rows, error: rowsError } = await deps.serviceClient
    .from('push_subscriptions')
    .select('id, member_id, endpoint, p256dh, auth')
    .in('member_id', memberIds);
  if (rowsError) {
    return jsonResponse(500, {
      code: 'LOOKUP_FAILED',
      error: 'Could not look up the devices.',
    });
  }

  const send = deps.send ?? ((target, payload, keys) => sendWebPush(target, payload, keys));
  const { summary, goneIds } = await deliver(
    (rows ?? []) as PushRow[],
    parsed.message,
    (target, payload) => send(target, payload, vapid)
  );

  if (goneIds.length > 0) {
    await deps.serviceClient.from('push_subscriptions').delete().in('id', goneIds);
  }
  return jsonResponse(200, summary);
}
