export function formatNestedError(error) {
  if (!error) return '';
  if (Array.isArray(error.errors) && error.errors.length) {
    return error.errors
      .map((item) => formatNestedError(item))
      .filter(Boolean)
      .join('; ');
  }
  if (error.cause) {
    const causeMessage = formatNestedError(error.cause);
    if (causeMessage) return causeMessage;
  }
  return String(error.message || error.code || error || '').trim();
}

export function logChannelTest(event, payload) {
  console.log(`[channels.imap] ${event}`, payload);
}

export function normalizeAddressList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => String((item && (item.address || item.name)) || '').trim())
    .filter(Boolean);
}

export function htmlToText(value) {
  return String(value == null ? '' : value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeMessageSource(sourceBuffer) {
  const raw = Buffer.isBuffer(sourceBuffer)
    ? sourceBuffer.toString('utf8')
    : String(sourceBuffer || '');
  if (!raw) return '';

  const separatorMatch = /\r?\n\r?\n/.exec(raw);
  const body = separatorMatch
    ? raw.slice(separatorMatch.index + separatorMatch[0].length)
    : raw;
  const normalized = body
    .replace(/=\r?\n/g, '')
    .replace(/=\s*([A-Fa-f0-9]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch (error) {
        return '';
      }
    });

  const text = /<html[\s>]/i.test(normalized)
    ? htmlToText(normalized)
    : normalized.replace(/\s+/g, ' ').trim();
  return text.slice(0, 12000);
}

export function streamToBuffer(stream, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const limit = Number(maxBytes) > 0 ? Number(maxBytes) : Infinity;

    stream.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > limit) {
        stream.destroy(new Error(`Attachment exceeds ${limit} bytes`));
        return;
      }
      chunks.push(buffer);
    });
    stream.once('error', reject);
    stream.once('end', () => resolve(Buffer.concat(chunks)));
  });
}
