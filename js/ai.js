import { blobToBase64 } from './image.js';
import { CATEGORIES, BRANDS } from './util.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

const PROMPT = `You are an expert at identifying heavy equipment, compact construction equipment, agricultural and landscaping machinery from photos.
Look at the photo(s) of ONE machine. Read any decals, nameplates, serial plates and signage. Return ONLY a JSON object (no prose, no code fences) with these keys:
{
  "brand": manufacturer, one of [${BRANDS.join(', ')}] if it matches, otherwise the name as printed,
  "model": model designation exactly as printed or best match (e.g. "T770", "SVL75-2", "E35"),
  "category": one of [${CATEGORIES.join(', ')}],
  "year": integer model/manufacture year or null,
  "year_basis": "nameplate" | "serial" | "model_generation" | "visual_estimate" | "unknown",
  "serial": serial number if legible else null,
  "hours": integer hour-meter reading if visible else null,
  "condition": "Excellent" | "Good" | "Fair" | "Poor" | "Unknown",
  "customer_hint": business name visible on signage or vehicle lettering, else null,
  "confidence": "high" | "medium" | "low",
  "notes": one short sentence on distinguishing features or what you could not read
}
Rules: never invent a serial number or reading you cannot see; use null for unknowns. If you estimate the year, say how in year_basis. Bobcat machines carry the Bobcat name on the cab/boom; many other brands make look-alike loaders, so rely on decals over shape.`;

export async function identify(blobs, { apiKey, model = DEFAULT_MODEL }) {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings first.');
  const content = [];
  for (const b of blobs.slice(0, 4)) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(b) } });
  }
  content.push({ type: 'text', text: PROMPT });

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'user', content }] }),
    });
  } catch {
    throw new Error('Network error. Check your signal and try again.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error?.message || ''; } catch { /* ignore */ }
    if (res.status === 401) throw new Error('API key rejected. Check it in Settings.');
    if (res.status === 429) throw new Error('Rate limited. Wait a moment and retry.');
    throw new Error(`AI request failed (${res.status}) ${msg}`.trim());
  }
  const data = await res.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return parseResult(text);
}

export function parseResult(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI returned an unreadable answer. Try another photo.');
  let o;
  try { o = JSON.parse(m[0]); } catch { throw new Error('AI returned an unreadable answer. Try another photo.'); }
  const year = parseInt(o.year, 10);
  const hours = parseInt(o.hours, 10);
  return {
    brand: o.brand || '',
    model: o.model || '',
    category: CATEGORIES.includes(o.category) ? o.category : '',
    year: year > 1900 && year < 2100 ? year : null,
    yearBasis: o.year_basis || 'unknown',
    serial: o.serial || '',
    hours: Number.isFinite(hours) ? hours : null,
    condition: ['Excellent', 'Good', 'Fair', 'Poor'].includes(o.condition) ? o.condition : '',
    customerHint: o.customer_hint || '',
    confidence: o.confidence || 'low',
    notes: o.notes || '',
  };
}
