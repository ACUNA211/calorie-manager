import { describe, expect, it, vi } from 'vitest';
import {
  classifyPushStatus,
  deliver,
  handleSendPush,
  readRequest,
  vapidFromEnv,
} from '../../../supabase/functions/_shared/send-push.ts';
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  vapidAuthorization,
} from '../../../supabase/functions/_shared/web-push.ts';

// A throwaway key pair made for this test only.
async function throwawayVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    pair,
    keys: {
      publicKey: b64urlEncode(publicRaw),
      privateKey: jwk.d,
      subject: 'mailto:t@example.com',
    },
  };
}

describe('classifyPushStatus', () => {
  it('accepts 2xx, removes on 404 and 410, keeps the row for anything else', () => {
    expect(classifyPushStatus(201)).toBe('sent');
    expect(classifyPushStatus(404)).toBe('gone');
    expect(classifyPushStatus(410)).toBe('gone');
    for (const status of [400, 401, 403, 413, 429, 500, 503]) {
      expect(classifyPushStatus(status)).toBe('failed');
    }
  });
});

describe('deliver', () => {
  it('collects the ids of expired subscriptions and counts the rest', async () => {
    const rows = [1, 2, 3, 4].map((id) => ({
      id,
      member_id: 9,
      endpoint: `https://e/${id}`,
      p256dh: 'p',
      auth: 'a',
    }));
    const statuses = { 1: 201, 2: 410, 3: 500, 4: 404 };
    const { summary, goneIds } = await deliver(
      rows,
      { title: 'T', body: 'B', url: '/' },
      async (target) => statuses[Number(target.endpoint.split('/').pop())]
    );
    expect(summary).toEqual({ sent: 1, removed: 2, failed: 1 });
    expect(goneIds).toEqual([2, 4]);
  });

  it('treats a network error as failed and keeps the row', async () => {
    const { summary, goneIds } = await deliver(
      [{ id: 1, member_id: 1, endpoint: 'https://e', p256dh: 'p', auth: 'a' }],
      { title: 'T', body: 'B', url: '/' },
      async () => {
        throw new Error('offline');
      }
    );
    expect(summary.failed).toBe(1);
    expect(goneIds).toEqual([]);
  });
});

describe('readRequest', () => {
  it('keeps only app paths and valid Member ids', () => {
    const parsed = readRequest({
      title: 'T',
      body: 'B',
      url: 'https://evil.example',
      memberIds: [3, 3, 'x', -1, 4],
    });
    expect(parsed.message.url).toBe('/');
    expect(parsed.memberIds).toEqual([3, 4]);
    expect(readRequest({ title: 'T', body: 'B', url: '/plan' }).message.url).toBe('/plan');
    expect(readRequest({ title: 'T', body: 'B', url: '//evil.example' }).message.url).toBe('/');
  });

  it('rejects a missing title or body', () => {
    expect(readRequest({ body: 'B' })).toHaveProperty('error');
    expect(readRequest({ title: 'T', body: '' })).toHaveProperty('error');
    expect(readRequest(null)).toHaveProperty('error');
  });
});

describe('vapidFromEnv', () => {
  it('needs all three settings', () => {
    const env = { VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x@y.z' };
    expect(vapidFromEnv((name) => env[name])).toEqual({
      publicKey: 'a',
      privateKey: 'b',
      subject: 'mailto:x@y.z',
    });
    expect(vapidFromEnv((name) => (name === 'VAPID_SUBJECT' ? undefined : env[name]))).toBeNull();
  });
});

describe('web push crypto', () => {
  it('signs a VAPID token the public key verifies', async () => {
    const { pair, keys } = await throwawayVapid();
    const header = await vapidAuthorization(
      'https://push.example/abc',
      keys,
      new Date('2026-10-19T00:00:00Z')
    );
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(claims)))).toEqual({
      aud: 'https://push.example',
      exp: Math.floor(new Date('2026-10-19T00:00:00Z').getTime() / 1000) + 12 * 3600,
      sub: 'mailto:t@example.com',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlDecode(signature),
      new TextEncoder().encode(`${head}.${claims}`)
    );
    expect(ok).toBe(true);
  });

  it('encrypts a message the device can decrypt (aes128gcm)', async () => {
    const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const devicePublic = new Uint8Array(await crypto.subtle.exportKey('raw', device.publicKey));
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const message = JSON.stringify({ title: 'Plan ready', body: 'Ñandú' });

    const body = await encryptPayload(new TextEncoder().encode(message), {
      p256dh: b64urlEncode(devicePublic),
      auth: b64urlEncode(authSecret),
    });

    // Receiver side (RFC 8291 section 3.4).
    const salt = body.slice(0, 16);
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
    const idLen = body[20];
    const senderPublic = body.slice(21, 21 + idLen);
    const cipher = body.slice(21 + idLen);
    const senderKey = await crypto.subtle.importKey(
      'raw',
      senderPublic,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, device.privateKey, 256)
    );
    const enc = new TextEncoder();
    const cat = (...p) => Uint8Array.from(p.flatMap((x) => Array.from(x)));
    const hk = async (s, ikm, info, n) =>
      new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: s, info },
          await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
          n * 8
        )
      );
    const ikm = await hk(
      authSecret,
      shared,
      cat(enc.encode('WebPush: info\0'), devicePublic, senderPublic),
      32
    );
    const cek = await hk(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hk(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']),
        cipher
      )
    );
    expect(plain[plain.length - 1]).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(message);
  });

  it('refuses a message that does not fit one record', async () => {
    await expect(encryptPayload(new Uint8Array(4000), { p256dh: 'x', auth: 'y' })).rejects.toThrow(
      'too long'
    );
  });
});

function fakeClients({ member = { id: 5 }, rows = [] } = {}) {
  const deleted = [];
  const userClient = {
    auth: {
      getUser: vi.fn(async (token) =>
        token === 'user-jwt'
          ? { data: { user: { id: 'u1' } }, error: null }
          : { data: { user: null }, error: new Error('bad') }
      ),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: member, error: null }),
      };
      return chain;
    },
  };
  const queried = [];
  const serviceClient = {
    from: () => ({
      select: () => ({
        in: async (_column, ids) => {
          queried.push(ids);
          return { data: rows.filter((row) => ids.includes(row.member_id)), error: null };
        },
      }),
      delete: () => ({
        in: async (_column, ids) => {
          deleted.push(...ids);
          return { error: null };
        },
      }),
    }),
  };
  return { userClient, serviceClient, deleted, queried };
}

const request = (token, body) =>
  new Request('https://x/send-push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

describe('handleSendPush', () => {
  const vapid = { publicKey: 'a', privateKey: 'b', subject: 'mailto:x@y.z' };
  const rows = [
    { id: 1, member_id: 5, endpoint: 'https://e/1', p256dh: 'p', auth: 'a' },
    { id: 2, member_id: 5, endpoint: 'https://e/2', p256dh: 'p', auth: 'a' },
    { id: 3, member_id: 6, endpoint: 'https://e/3', p256dh: 'p', auth: 'a' },
  ];

  it("sends a signed-in Member's test to their own devices only and removes expired ones", async () => {
    const clients = fakeClients({ rows });
    const send = vi.fn(async (target) => (target.endpoint === 'https://e/2' ? 410 : 201));
    const res = await handleSendPush(
      request('user-jwt', { title: 'T', body: 'B', memberIds: [6] }),
      {
        ...clients,
        serviceRoleKey: 'service',
        vapid,
        send,
      }
    );
    expect(await res.json()).toEqual({ sent: 1, removed: 1, failed: 0 });
    expect(clients.queried).toEqual([[5]]);
    expect(clients.deleted).toEqual([2]);
  });

  it('lets a trusted server caller name the Members', async () => {
    const clients = fakeClients({ rows });
    const send = vi.fn(async () => 201);
    const res = await handleSendPush(
      request('service', { title: 'T', body: 'B', memberIds: [6] }),
      {
        ...clients,
        serviceRoleKey: 'service',
        vapid,
        send,
      }
    );
    expect(await res.json()).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(clients.queried).toEqual([[6]]);
  });

  it('refuses a caller who is not signed in, and reports missing keys', async () => {
    const clients = fakeClients({ rows });
    const deps = { ...clients, serviceRoleKey: 'service', vapid, send: vi.fn() };
    expect((await handleSendPush(request('wrong', { title: 'T', body: 'B' }), deps)).status).toBe(
      401
    );
    const noKeys = await handleSendPush(request('user-jwt', { title: 'T', body: 'B' }), {
      ...deps,
      vapid: null,
    });
    expect(noKeys.status).toBe(500);
    expect(deps.send).not.toHaveBeenCalled();
  });
});
