import { describe, it, expect, vi } from 'vitest';
import recorded from '../test/recorded/read-label-oat-drink.json';
import {
  checkLabelShape,
  handleReadLabelRequest,
  LABEL_MODEL,
  LabelReplyError,
  LabelUnreadableError,
  MAX_PHOTO_BYTES,
  parseLabelReply,
} from '../../../supabase/functions/_shared/read-label.ts';
import {
  labelPhotoToFormValues,
  LabelPhotoError,
  readingToFormValues,
  readLabelPhoto,
  uploadLabelPhoto,
} from './labelPhoto.js';
import { parseLabelForm } from './label.js';

const recordedText = recorded.content[0].text;

function fakeUserClient({
  user = { id: 'user-1' },
  member = { id: 5, household_id: 3 },
  blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
} = {}) {
  const download = vi.fn(async () =>
    blob ? { data: blob, error: null } : { data: null, error: new Error('missing') }
  );
  return {
    download,
    auth: {
      getUser: vi.fn(async () =>
        user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad') }
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
    storage: { from: () => ({ download }) },
  };
}

function fakeServiceClient({ cap = 5, spentRows = [] } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        maybeSingle: async () => ({
          data: table === 'household_settings' ? { ai_monthly_cap_usd: cap } : null,
          error: null,
        }),
        insert: async (row) => {
          inserts.push({ table, row });
          return { error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: table === 'ai_usage' ? spentRows : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

const anthropicResponse = (payload = recorded, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

function request(
  body = { path: '3/photo.jpg' },
  { method = 'POST', auth = 'Bearer test-token' } = {}
) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = auth;
  return new Request('https://example.test/functions/v1/read-label', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('parseLabelReply (recorded reply)', () => {
  it('reads the recorded reply into the label values', () => {
    expect(parseLabelReply(recordedText)).toEqual({
      name: 'Oat drink',
      brand: 'Oatly',
      servingGrams: 250,
      kcal: 92,
      protein: 1,
      carbs: 15,
      fat: 3,
      fibre: null,
      sugars: 7,
      sodium: 100,
    });
  });

  it('accepts the same JSON inside one code fence', () => {
    expect(parseLabelReply('```json\n' + recordedText + '\n```').kcal).toBe(92);
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseLabelReply('It is an oat drink.')).toThrow(LabelReplyError);
  });

  it('treats readable:false as an unreadable photo', () => {
    expect(() => parseLabelReply('{"readable":false}')).toThrow(LabelUnreadableError);
  });

  it('treats a panel with no calories and no serving size as unreadable', () => {
    const empty = JSON.parse(recordedText);
    empty.kcal = null;
    empty.servingGrams = null;
    expect(() => checkLabelShape(empty)).toThrow(LabelUnreadableError);
  });

  it('refuses extra keys, text numbers and negative numbers', () => {
    const base = JSON.parse(recordedText);
    expect(() => checkLabelShape({ ...base, extra: 1 })).toThrow(LabelReplyError);
    expect(() => checkLabelShape({ ...base, kcal: '92' })).toThrow(LabelReplyError);
    expect(() => checkLabelShape({ ...base, fat: -1 })).toThrow(LabelReplyError);
  });
});

describe('pre-fill mapping', () => {
  const reading = parseLabelReply(recordedText);

  it('fills the name, serving size, calories and the macros as text; a missing value stays empty', () => {
    expect(readingToFormValues(reading, 'metric')).toEqual({
      name: 'Oat drink',
      brand: 'Oatly',
      servingGrams: '250',
      kcal: '92',
      protein: '1',
      carbs: '15',
      fat: '3',
      fibre: '',
      sugars: '7',
      sodium: '100',
    });
  });

  it('shows mass in ounces for US units but leaves calories and sodium alone', () => {
    const values = readingToFormValues(reading, 'us');
    expect(values.servingGrams).toBe('8.82');
    expect(values.kcal).toBe('92');
    expect(values.sodium).toBe('100');
  });

  it('gives a form the existing label check accepts, and the grams survive the round trip', () => {
    const outcome = parseLabelForm(readingToFormValues(reading, 'metric'), 'metric');
    expect(outcome.ok).toBe(true);
    expect(outcome.food.servingGrams).toBe(250);
    expect(outcome.food.per100g.kcal).toBe(36.8);
    expect(outcome.food.perServing.fibre).toBeNull();
  });
});

describe('handleReadLabelRequest (recorded reply)', () => {
  it('reads the label, sends the photo as an image, and records one ledger row', async () => {
    const service = fakeServiceClient();
    const fetchFn = vi.fn(async () => anthropicResponse());
    const response = await handleReadLabelRequest(request(), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'test-key',
      fetchFn,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).kcal).toBe(92);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(sent.model).toBe(LABEL_MODEL);
    expect(sent.messages[0].content[0].source.media_type).toBe('image/jpeg');
    expect(sent.messages[0].content[0].source.data).toBe('AQID');
    expect(fetchFn.mock.calls[0][1].headers['x-api-key']).toBe('test-key');

    expect(service.inserts).toHaveLength(1);
    expect(service.inserts[0].table).toBe('ai_usage');
    expect(service.inserts[0].row).toMatchObject({
      household_id: 3,
      member_id: 5,
      provider: 'anthropic',
      model: LABEL_MODEL,
      input_tokens: 1650,
      output_tokens: 62,
    });
  });

  it('refuses over the cap before any AI call and records nothing', async () => {
    const service = fakeServiceClient({ cap: 1, spentRows: [{ cost_usd: 1.5 }] });
    const fetchFn = vi.fn(async () => anthropicResponse());
    const response = await handleReadLabelRequest(request(), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'test-key',
      fetchFn,
    });
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('AI_LIMIT_REACHED');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(service.inserts).toHaveLength(0);
  });

  it('answers 422 UNREADABLE (and still records the spent tokens) for an unreadable photo', async () => {
    const service = fakeServiceClient();
    const unreadable = {
      ...recorded,
      content: [{ type: 'text', text: '{"readable":false}' }],
    };
    const response = await handleReadLabelRequest(request(), {
      userClient: fakeUserClient(),
      serviceClient: service,
      apiKey: 'test-key',
      fetchFn: vi.fn(async () => anthropicResponse(unreadable)),
    });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('UNREADABLE');
    expect(service.inserts).toHaveLength(1);
  });

  it('refuses a path outside the caller Household folder without touching storage or the AI', async () => {
    const user = fakeUserClient();
    const fetchFn = vi.fn();
    for (const path of ['4/photo.jpg', '3/../4/photo.jpg', '3/a/b.jpg', 'photo.jpg']) {
      const response = await handleReadLabelRequest(request({ path }), {
        userClient: user,
        serviceClient: fakeServiceClient(),
        apiKey: 'test-key',
        fetchFn,
      });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('BAD_PATH');
    }
    expect(user.download).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 401 without sign-in, 404 for a missing photo, 400 for a wrong type or size', async () => {
    const deps = (userClient) => ({
      userClient,
      serviceClient: fakeServiceClient(),
      apiKey: 'test-key',
      fetchFn: vi.fn(),
    });
    expect(
      (await handleReadLabelRequest(request(undefined, { auth: null }), deps(fakeUserClient())))
        .status
    ).toBe(401);
    expect(
      (await handleReadLabelRequest(request(), deps(fakeUserClient({ blob: null })))).status
    ).toBe(404);
    const text = new Blob(['hi'], { type: 'text/plain' });
    expect(
      (await handleReadLabelRequest(request(), deps(fakeUserClient({ blob: text })))).status
    ).toBe(400);
    const big = {
      size: MAX_PHOTO_BYTES + 1,
      type: 'image/jpeg',
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    expect(
      (await handleReadLabelRequest(request(), deps(fakeUserClient({ blob: big })))).status
    ).toBe(400);
  });

  it('answers 500 NOT_CONFIGURED without a key', async () => {
    const response = await handleReadLabelRequest(request(), {
      userClient: fakeUserClient(),
      serviceClient: fakeServiceClient(),
      apiKey: undefined,
      fetchFn: vi.fn(),
    });
    expect(response.status).toBe(500);
  });
});

describe('app side (labelPhoto.js)', () => {
  const photo = new File([new Uint8Array([1, 2, 3])], 'label.jpg', { type: 'image/jpeg' });

  function fakeAppClient({ invoke, uploadError = null } = {}) {
    const upload = vi.fn(async () => ({ error: uploadError }));
    return {
      upload,
      from: () => ({
        select: () => ({ maybeSingle: async () => ({ data: { household_id: 3 }, error: null }) }),
      }),
      storage: { from: vi.fn(() => ({ upload })) },
      functions: {
        invoke: invoke ?? vi.fn(async () => ({ data: parseLabelReply(recordedText), error: null })),
      },
    };
  }

  it('uploads into the Household folder and returns the path', async () => {
    const client = fakeAppClient();
    const path = await uploadLabelPhoto(client, photo, 'abc');
    expect(path).toBe('3/abc.jpg');
    expect(client.storage.from).toHaveBeenCalledWith('label-photos');
    expect(client.upload.mock.calls[0][0]).toBe('3/abc.jpg');
  });

  it('refuses a non-image before any upload', async () => {
    const client = fakeAppClient();
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    await expect(uploadLabelPhoto(client, pdf)).rejects.toMatchObject({ code: 'badPhoto' });
    expect(client.upload).not.toHaveBeenCalled();
  });

  it('turns the cap refusal into code cap and an unreadable reply into code unreadable', async () => {
    const failing = (code) =>
      vi.fn(async () => ({
        data: null,
        error: { context: { json: async () => ({ code }) } },
      }));
    await expect(
      readLabelPhoto(fakeAppClient({ invoke: failing('AI_LIMIT_REACHED') }), '3/a.jpg')
    ).rejects.toMatchObject({ code: 'cap' });
    await expect(
      readLabelPhoto(fakeAppClient({ invoke: failing('UNREADABLE') }), '3/a.jpg')
    ).rejects.toMatchObject({ code: 'unreadable' });
    await expect(
      readLabelPhoto(fakeAppClient({ invoke: failing('AI_FAILED') }), '3/a.jpg')
    ).rejects.toBeInstanceOf(LabelPhotoError);
  });

  it('goes from photo to form values using the recorded reading', async () => {
    const client = fakeAppClient();
    const values = await labelPhotoToFormValues(client, photo, 'metric');
    expect(values.name).toBe('Oat drink');
    expect(values.kcal).toBe('92');
    expect(client.functions.invoke).toHaveBeenCalledWith('read-label', {
      body: { path: expect.stringMatching(/^3\/.+\.jpg$/) },
    });
  });
});
