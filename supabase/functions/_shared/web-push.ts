// Web Push sender for Edge Functions (ticket #54). Built on WebCrypto and fetch only, so it
// runs in Deno with no Node compatibility layer: VAPID (RFC 8292) signs who is sending, and
// the message is encrypted for the device with aes128gcm (RFC 8291 and RFC 8188).
//
// The VAPID private key arrives from the function's env (`supabase secrets set`); this file
// never stores or logs it.

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  // Base64url, as printed by `npx web-push generate-vapid-keys`.
  publicKey: string;
  privateKey: string;
  // A mailto: or https: contact for the push service, such as mailto:you@example.com.
  subject: string;
}

export interface PushOptions {
  // Seconds the push service may hold the message for an offline device.
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  now?: () => Date;
  fetchFn?: typeof fetch;
}

// One record holds 4096 bytes: 86 for the header, 16 for the tag and 1 for the padding byte.
export const MAX_PAYLOAD_BYTES = 3993;
const RECORD_SIZE = 4096;

const encoder = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array {
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// Encrypts a message for one device. The sender key pair and salt are random unless a test
// passes them in. Returns the request body.
export async function encryptPayload(
  plaintext: Uint8Array,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  fixed?: { senderKeys?: CryptoKeyPair; salt?: Uint8Array }
): Promise<Uint8Array> {
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('Push message is too long');
  const uaPublic = b64urlDecode(target.p256dh);
  const authSecret = b64urlDecode(target.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Bad device public key');

  const senderKeys =
    fixed?.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderKeys.privateKey, 256)
  );

  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, senderPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  // A single, last record: the message followed by the delimiter byte 0x02.
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record)
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, cipher);
}

// The `Authorization` header value that proves the sender holds the VAPID key (RFC 8292).
export async function vapidAuthorization(
  endpoint: string,
  vapid: VapidKeys,
  now: Date = new Date()
): Promise<string> {
  const publicBytes = b64urlDecode(vapid.publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error('Bad VAPID public key');
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(publicBytes.slice(1, 33)),
    y: b64urlEncode(publicBytes.slice(33, 65)),
    d: vapid.privateKey,
  };
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const header = b64urlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        // At most 24 hours ahead; 12 is the usual choice.
        exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
        sub: vapid.subject,
      })
    )
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      encoder.encode(`${header}.${claims}`)
    )
  );
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${vapid.publicKey}`;
}

// Sends one message to one device. Returns the push service's HTTP status; a network failure
// throws. The caller decides what the status means (see classifyPushStatus in send-push.ts).
export async function sendWebPush(
  target: PushTarget,
  message: string,
  vapid: VapidKeys,
  options: PushOptions = {}
): Promise<number> {
  const body = await encryptPayload(encoder.encode(message), target);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, vapid, options.now?.()),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 3600),
  };
  if (options.urgency) headers.Urgency = options.urgency;
  const res = await (options.fetchFn ?? fetch)(target.endpoint, {
    method: 'POST',
    headers,
    body,
  });
  // Drain the body so the connection is released.
  await res.text().catch(() => '');
  return res.status;
}
