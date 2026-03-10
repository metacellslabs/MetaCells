import { AppSettings, DEFAULT_SETTINGS_ID, ensureDefaultSettings } from "../settings/index.js";
import { normalizeChannelLabel } from "./mentioning.js";

function buildChannelPayloadMapFromChannels(channels) {
  const map = {};
  const source = Array.isArray(channels) ? channels : [];
  for (let i = 0; i < source.length; i += 1) {
    const channel = source[i];
    if (!channel || typeof channel !== "object") continue;
    const label = normalizeChannelLabel(channel.label);
    if (!label || !channel.lastEvent || typeof channel.lastEvent !== "object") continue;
    map[label] = {
      ...channel.lastEvent,
      label: String(channel.label || ""),
      channelId: String(channel.id || ""),
      connectorId: String(channel.connectorId || channel.type || ""),
    };
  }
  return map;
}

export async function getActiveChannelPayloadMap() {
  await ensureDefaultSettings();
  const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
  return buildChannelPayloadMapFromChannels(current && current.communicationChannels);
}

