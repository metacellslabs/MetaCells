import {
  DEFAULT_JOB_SETTINGS,
} from '../../../api/settings/index.js';

export function buildProviderDrafts(providers, savedProviders) {
  const registered = Array.isArray(providers) ? providers : [];
  const saved = Array.isArray(savedProviders) ? savedProviders : [];
  const byId = new Map();
  const byType = new Map();
  const typeCounts = registered.reduce((acc, provider) => {
    const type = String(provider && provider.type ? provider.type : '');
    if (!type) return acc;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  for (let i = 0; i < saved.length; i += 1) {
    const provider = saved[i];
    if (!provider || typeof provider !== 'object') continue;
    if (provider.id) byId.set(String(provider.id), provider);
    if (provider.type && typeCounts[String(provider.type)] === 1) {
      byType.set(String(provider.type), provider);
    }
  }

  return registered.reduce((acc, provider) => {
    const persisted = byId.get(provider.id) || byType.get(provider.type) || {};
    acc[provider.id] = {
      ...provider,
      ...persisted,
      id: String(persisted.id || provider.id || ''),
      name: String(persisted.name || provider.name || ''),
      type: String(persisted.type || provider.type || ''),
      baseUrl: String(persisted.baseUrl || provider.baseUrl || ''),
      model: String(persisted.model || provider.model || ''),
      apiKey: String(persisted.apiKey || ''),
      enabled: persisted.enabled !== false,
      availableModels: Array.isArray(provider.availableModels)
        ? provider.availableModels.slice()
        : [],
      fields: Array.isArray(provider.fields) ? provider.fields.slice() : [],
    };
    return acc;
  }, {});
}

export function isLoopbackUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch (error) {
    return false;
  }
}

export function providerAllowsBlankApiKey(provider) {
  const source = provider && typeof provider === 'object' ? provider : {};
  const providerId = String(source.id || '').trim();
  const providerType = String(source.type || '').trim();
  const baseUrl = String(source.baseUrl || '').trim();

  return (
    providerType === 'lm_studio' ||
    providerId === 'ollama' ||
    isLoopbackUrl(baseUrl)
  );
}

export function getProviderMissingFields(provider) {
  const source = provider && typeof provider === 'object' ? provider : {};
  const missing = [];
  if (!String(source.baseUrl || '').trim()) {
    missing.push('baseUrl');
  }
  if (
    !providerAllowsBlankApiKey(source) &&
    !String(source.apiKey || '').trim()
  ) {
    missing.push('apiKey');
  }
  return missing;
}

export function isProviderConfigured(provider) {
  return getProviderMissingFields(provider).length === 0;
}

export function getActiveProviderRecord(settings, registeredProviders) {
  const providers = Array.isArray(settings && settings.aiProviders)
    ? settings.aiProviders
    : [];
  const fallbackId = String(
    (registeredProviders &&
      registeredProviders[0] &&
      registeredProviders[0].id) ||
      '',
  );
  const activeProviderId = String(
    (settings && settings.activeAIProviderId) || fallbackId,
  );

  return (
    providers.find((provider) => provider && provider.id === activeProviderId) ||
    (Array.isArray(registeredProviders)
      ? registeredProviders.find(
          (provider) => provider && provider.id === activeProviderId,
        )
      : null) ||
    (Array.isArray(registeredProviders) ? registeredProviders[0] : null) ||
    null
  );
}

export function buildChannelDrafts(connectors, savedChannels) {
  const registered = Array.isArray(connectors) ? connectors : [];
  const saved = Array.isArray(savedChannels) ? savedChannels : [];

  return saved.reduce((acc, channel) => {
    if (!channel || typeof channel !== 'object' || !channel.id) return acc;
    const connector =
      registered.find((item) => item && item.id === channel.connectorId) ||
      null;
    const settings =
      channel.settings && typeof channel.settings === 'object'
        ? channel.settings
        : {};
    const nextSettings = { ...settings };

    if (connector && Array.isArray(connector.settingsFields)) {
      connector.settingsFields.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(nextSettings, field.key)) {
          nextSettings[field.key] =
            field.defaultValue == null ? '' : field.defaultValue;
        }
      });
    }

    acc[channel.id] = {
      id: String(channel.id || ''),
      connectorId: String(channel.connectorId || ''),
      label: String(channel.label || connector?.name || ''),
      enabled: channel.enabled !== false,
      status: String(channel.status || 'pending'),
      lastTestMessage: String(channel.lastTestMessage || ''),
      lastSeenUid: Number(channel.lastSeenUid) || 0,
      lastEventId: String(channel.lastEventId || ''),
      lastEventPreview:
        channel.lastEventPreview && typeof channel.lastEventPreview === 'object'
          ? channel.lastEventPreview
          : null,
      lastEventAt: channel.lastEventAt || null,
      lastPolledAt: channel.lastPolledAt || null,
      watchError: String(channel.watchError || ''),
      settings: nextSettings,
    };
    return acc;
  }, {});
}

export function buildJobSettingsDraft(jobSettings) {
  const source =
    jobSettings && typeof jobSettings === 'object' ? jobSettings : {};
  return {
    workerEnabled: source.workerEnabled !== false,
    aiChatConcurrency:
      Number(source.aiChatConcurrency) ||
      DEFAULT_JOB_SETTINGS.aiChatConcurrency,
    aiChatMaxAttempts:
      Number(source.aiChatMaxAttempts) ||
      DEFAULT_JOB_SETTINGS.aiChatMaxAttempts,
    aiChatRetryDelayMs:
      Number(source.aiChatRetryDelayMs) ||
      DEFAULT_JOB_SETTINGS.aiChatRetryDelayMs,
    aiChatTimeoutMs:
      Number(source.aiChatTimeoutMs) || DEFAULT_JOB_SETTINGS.aiChatTimeoutMs,
    aiChatLeaseTimeoutMs:
      Number(source.aiChatLeaseTimeoutMs) ||
      DEFAULT_JOB_SETTINGS.aiChatLeaseTimeoutMs,
    aiChatHeartbeatIntervalMs:
      Number(source.aiChatHeartbeatIntervalMs) ||
      DEFAULT_JOB_SETTINGS.aiChatHeartbeatIntervalMs,
    fileExtractConcurrency:
      Number(source.fileExtractConcurrency) ||
      DEFAULT_JOB_SETTINGS.fileExtractConcurrency,
    fileExtractMaxAttempts:
      Number(source.fileExtractMaxAttempts) ||
      DEFAULT_JOB_SETTINGS.fileExtractMaxAttempts,
    fileExtractRetryDelayMs:
      Number(source.fileExtractRetryDelayMs) ||
      DEFAULT_JOB_SETTINGS.fileExtractRetryDelayMs,
    fileExtractTimeoutMs:
      Number(source.fileExtractTimeoutMs) ||
      DEFAULT_JOB_SETTINGS.fileExtractTimeoutMs,
    fileExtractLeaseTimeoutMs:
      Number(source.fileExtractLeaseTimeoutMs) ||
      DEFAULT_JOB_SETTINGS.fileExtractLeaseTimeoutMs,
    fileExtractHeartbeatIntervalMs:
      Number(source.fileExtractHeartbeatIntervalMs) ||
      DEFAULT_JOB_SETTINGS.fileExtractHeartbeatIntervalMs,
  };
}

export function readSettingsTabFromUrl(validTabs) {
  const allowed = Array.isArray(validTabs) ? validTabs : [];
  const fallback = allowed[0] || 'ai';
  try {
    const params = new URLSearchParams(window.location.search || '');
    const tab = String(params.get('tab') || '').trim();
    return allowed.includes(tab) ? tab : fallback;
  } catch (error) {
    return fallback;
  }
}
