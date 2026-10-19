// Label photo (ticket #66): the app side. The Member takes a photo of a Nutrition Facts
// label; it is shrunk, stored in the Household's folder of the private label-photos bucket,
// and the read-label Edge Function reads it with one AI call (through the AI cap). The
// reading only pre-fills ticket 20's label form: nothing is saved until the Member confirms.
//
// The Supabase client is always the first argument, so tests pass a fake.

import { toInputMass } from './units.js';

export const LABEL_BUCKET = 'label-photos';
export const READ_LABEL_FUNCTION = 'read-label';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The label form's mass fields. A reading holds grams; in US units the form takes ounces.
const MASS_FIELDS = ['servingGrams', 'protein', 'carbs', 'fat', 'fibre', 'sugars'];
const PLAIN_NUMBER_FIELDS = ['kcal', 'sodium'];

// code: 'cap' (over the AI cap), 'unreadable' (no readable label), 'badPhoto' (not an image,
// or too large), 'failed' (anything else)
export class LabelPhotoError extends Error {
  constructor(code) {
    super(`Label photo failed: ${code}`);
    this.name = 'LabelPhotoError';
    this.code = code;
  }
}

const ERROR_CODES = { AI_LIMIT_REACHED: 'cap', UNREADABLE: 'unreadable' };

async function errorCode(error) {
  try {
    const body = await error?.context?.json();
    return body?.code ?? null;
  } catch {
    return null;
  }
}

// A reading from the function as the label form's text boxes hold it. A value the label did
// not show is left empty, never 0. Mass values are shown in the Member's units.
export function readingToFormValues(reading, units = 'metric') {
  const values = {
    name: typeof reading?.name === 'string' ? reading.name : '',
    brand: typeof reading?.brand === 'string' ? reading.brand : '',
  };
  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  for (const field of MASS_FIELDS) {
    values[field] = isNumber(reading?.[field]) ? toInputMass(reading[field], units) : '';
  }
  for (const field of PLAIN_NUMBER_FIELDS) {
    values[field] = isNumber(reading?.[field]) ? String(Math.round(reading[field] * 10) / 10) : '';
  }
  return values;
}

// Checks the chosen file before any upload.
export function checkPhotoFile(file) {
  if (!file || !PHOTO_TYPES.includes(file.type)) return 'badPhoto';
  return null;
}

// Shrinks a big phone photo to a JPEG no wider than PHOTO_MAX_EDGE, so the upload is small
// and under the server's limit. Browser-only; returns the file untouched when the browser
// cannot do it (the server still refuses a file over 5 MB).
export async function shrinkPhoto(file) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

async function householdId(client) {
  const { data, error } = await client.from('members').select('household_id').maybeSingle();
  if (error || !data) throw new LabelPhotoError('failed');
  return data.household_id;
}

// Stores the photo at <household id>/<random>.<ext> and returns that path.
export async function uploadLabelPhoto(client, file, id = crypto.randomUUID()) {
  if (checkPhotoFile(file) || file.size > MAX_PHOTO_BYTES) throw new LabelPhotoError('badPhoto');
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${await householdId(client)}/${id}.${extension}`;
  const { error } = await client.storage
    .from(LABEL_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new LabelPhotoError('failed');
  return path;
}

// Asks the read-label Edge Function to read the stored photo. Returns the reading
// (per-serving values, null where unreadable).
export async function readLabelPhoto(client, path) {
  let response;
  try {
    response = await client.functions.invoke(READ_LABEL_FUNCTION, { body: { path } });
  } catch {
    throw new LabelPhotoError('failed');
  }
  const { data, error } = response ?? {};
  if (error) throw new LabelPhotoError(ERROR_CODES[await errorCode(error)] ?? 'failed');
  if (!data || typeof data !== 'object' || !('kcal' in data) || !('servingGrams' in data)) {
    throw new LabelPhotoError('failed');
  }
  return data;
}

// The whole step: shrink, store, read. Returns the label form's values.
export async function labelPhotoToFormValues(client, file, units = 'metric') {
  if (checkPhotoFile(file)) throw new LabelPhotoError('badPhoto');
  const small = await shrinkPhoto(file);
  const path = await uploadLabelPhoto(client, small);
  const reading = await readLabelPhoto(client, path);
  return readingToFormValues(reading, units);
}
