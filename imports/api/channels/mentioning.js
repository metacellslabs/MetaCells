export const CHANNEL_POLL_INTERVAL_MS = 30000;

function normalizeWhitespace(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

export function normalizeChannelLabel(label) {
  return normalizeWhitespace(label).toLowerCase();
}

export function extractChannelMentionLabels(text) {
  const source = String(text == null ? "" : text);
  if (!source) return [];

  const labels = [];
  const seen = new Set();
  const pattern = /(^|[^A-Za-z0-9_:/])\/([A-Za-z][A-Za-z0-9_-]*)\b/g;
  let match;

  while ((match = pattern.exec(source))) {
    const label = normalizeChannelLabel(match[2]);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}

export function formatChannelEventForPrompt(payload) {
  const source = payload && typeof payload === "object" ? payload : null;
  if (!source) return "";

  const lines = [];
  const event = normalizeWhitespace(source.event || source.type || "message.new");
  const channelLabel = normalizeWhitespace(source.label || "");
  const mailbox = normalizeWhitespace(source.mailbox || "");
  const subject = normalizeWhitespace(source.subject || "");
  const from = Array.isArray(source.from) ? source.from.map(normalizeWhitespace).filter(Boolean) : [];
  const to = Array.isArray(source.to) ? source.to.map(normalizeWhitespace).filter(Boolean) : [];
  const date = normalizeWhitespace(source.date || source.receivedAt || "");
  const text = String(source.text == null ? "" : source.text).trim();

  if (event) lines.push(`Event: ${event}`);
  if (channelLabel) lines.push(`Channel: ${channelLabel}`);
  if (mailbox) lines.push(`Mailbox: ${mailbox}`);
  if (subject) lines.push(`Subject: ${subject}`);
  if (from.length) lines.push(`From: ${from.join(", ")}`);
  if (to.length) lines.push(`To: ${to.join(", ")}`);
  if (date) lines.push(`Date: ${date}`);
  if (text) {
    lines.push("Message:");
    lines.push(text);
  }

  return lines.join("\n").trim();
}

