import { ChannelEvents } from '../events.js';

function normalizeSearchOptions(options) {
  const source = options && typeof options === 'object' ? options : {};
  return {
    limit: Math.max(1, Math.min(100, parseInt(source.limit, 10) || 20)),
  };
}

function flattenSearchableText(value, parts) {
  const bucket = Array.isArray(parts) ? parts : [];
  if (value == null) return bucket;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenSearchableText(item, bucket));
    return bucket;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      flattenSearchableText(value[key], bucket);
    });
    return bucket;
  }
  const text = String(value).trim();
  if (text) bucket.push(text);
  return bucket;
}

function buildChannelEventSearchResult(doc) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const data =
    source.data && typeof source.data === 'object' ? source.data : {};
  const title = String(
    data.title ||
      data.name ||
      source.subject ||
      data.summary ||
      source.event ||
      'Channel event',
  ).trim();
  const summary = String(
    data.summary ||
      source.text ||
      data.text ||
      data.url ||
      source.subject ||
      '',
  ).trim();
  const url = String(
    data.url ||
      data.webViewLink ||
      data.webContentLink ||
      data.htmlUrl ||
      '',
  ).trim();
  return {
    id: String(source._id || ''),
    title,
    summary,
    url,
    createdAt:
      source.createdAt instanceof Date
        ? source.createdAt.toISOString()
        : String(source.createdAt || ''),
    connectorId: String(source.connectorId || ''),
    label: String(source.label || ''),
    event: String(source.event || ''),
    raw: {
      subject: String(source.subject || ''),
      text: String(source.text || ''),
      data,
    },
  };
}

export async function searchChannelEventHistory(channel, query, options) {
  const source = channel && typeof channel === 'object' ? channel : {};
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const searchOptions = normalizeSearchOptions(options);
  const recent = await ChannelEvents.find(
    {
      $or: [
        { channelId: String(source.id || '') },
        { label: String(source.label || '') },
      ],
    },
    {
      sort: { createdAt: -1, _id: -1 },
      limit: Math.max(50, searchOptions.limit * 10),
    },
  ).fetchAsync();

  const filtered = recent.filter((doc) => {
    if (!normalizedQuery) return true;
    const haystack = flattenSearchableText(doc, []).join('\n').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return {
    ok: true,
    query: String(query || ''),
    source: 'channel_events',
    total: filtered.length,
    items: filtered
      .slice(0, searchOptions.limit)
      .map((doc) => buildChannelEventSearchResult(doc)),
  };
}
