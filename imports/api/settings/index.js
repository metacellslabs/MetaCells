import { Mongo } from "meteor/mongo";
import { Meteor } from "meteor/meteor";
import { check, Match } from "meteor/check";

export const AppSettings = new Mongo.Collection("app_settings");

export const DEFAULT_SETTINGS_ID = "default";
export const DEFAULT_LM_STUDIO_PROVIDER = {
  id: "lm-studio",
  name: "LM Studio",
  type: "lm_studio",
  baseUrl: "http://127.0.0.1:1234/v1",
  model: "",
  apiKey: "",
  enabled: true,
};
export const DEFAULT_DEEPSEEK_PROVIDER = {
  id: "deepseek",
  name: "DeepSeek",
  type: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  apiKey: "",
  enabled: true,
};

function normalizeProvider(provider, fallback) {
  const source = provider && typeof provider === "object" ? provider : {};
  const base = fallback || DEFAULT_LM_STUDIO_PROVIDER;
  return {
    id: String(source.id || base.id).trim(),
    name: String(source.name || base.name).trim(),
    type: String(source.type || base.type).trim(),
    baseUrl: String(source.baseUrl || base.baseUrl).trim(),
    model: String(source.model || base.model || "").trim(),
    apiKey: String(source.apiKey || "").trim(),
    enabled: source.enabled !== false,
  };
}

function normalizeProviders(providers) {
  const input = Array.isArray(providers) ? providers : [];
  const byType = new Map();
  for (let i = 0; i < input.length; i += 1) {
    const provider = input[i];
    if (!provider || typeof provider !== "object" || !provider.type) continue;
    byType.set(String(provider.type), provider);
  }

  return [
    normalizeProvider(byType.get("deepseek"), DEFAULT_DEEPSEEK_PROVIDER),
    normalizeProvider(byType.get("lm_studio"), DEFAULT_LM_STUDIO_PROVIDER),
  ];
}

function createDefaultSettingsDoc() {
  const now = new Date();
  return {
    _id: DEFAULT_SETTINGS_ID,
    aiProviders: normalizeProviders([DEFAULT_DEEPSEEK_PROVIDER, DEFAULT_LM_STUDIO_PROVIDER]),
    activeAIProviderId: DEFAULT_DEEPSEEK_PROVIDER.id,
    communicationChannels: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureDefaultSettings() {
  const existing = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
  if (existing) return existing;

  const doc = createDefaultSettingsDoc();
  await AppSettings.insertAsync(doc);
  return doc;
}

export async function resetLMStudioBaseUrlInDb() {
  await ensureDefaultSettings();

  const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
  const providers = normalizeProviders(current && current.aiProviders);
  const nextProviders = providers.map((provider) => {
    if (provider.type !== "lm_studio") return provider;
    return {
      ...provider,
      id: DEFAULT_LM_STUDIO_PROVIDER.id,
      name: DEFAULT_LM_STUDIO_PROVIDER.name,
      type: DEFAULT_LM_STUDIO_PROVIDER.type,
      baseUrl: DEFAULT_LM_STUDIO_PROVIDER.baseUrl,
      model: DEFAULT_LM_STUDIO_PROVIDER.model,
    };
  });

  await AppSettings.updateAsync(
    { _id: DEFAULT_SETTINGS_ID },
    {
      $set: {
        aiProviders: nextProviders,
        activeAIProviderId:
          String(current && current.activeAIProviderId || "") || DEFAULT_DEEPSEEK_PROVIDER.id,
        updatedAt: new Date(),
      },
    },
  );

  return DEFAULT_LM_STUDIO_PROVIDER.baseUrl;
}

export async function getLMStudioBaseUrl() {
  const settings = await ensureDefaultSettings();
  const providers = normalizeProviders(settings.aiProviders);
  const provider = providers.find((item) => item && item.type === "lm_studio" && item.enabled !== false);
  return (provider && provider.baseUrl) || DEFAULT_LM_STUDIO_PROVIDER.baseUrl;
}

export async function getActiveAIProvider() {
  const settings = await ensureDefaultSettings();
  const providers = normalizeProviders(settings.aiProviders);
  const activeId = String(settings && settings.activeAIProviderId || DEFAULT_DEEPSEEK_PROVIDER.id);
  const activeProvider = providers.find((item) => item && item.id === activeId && item.enabled !== false);
  if (activeProvider) return activeProvider;
  const deepseek = providers.find((item) => item && item.type === "deepseek" && item.enabled !== false);
  if (deepseek) return deepseek;
  const lmStudio = providers.find((item) => item && item.type === "lm_studio" && item.enabled !== false);
  return lmStudio || normalizeProvider(DEFAULT_DEEPSEEK_PROVIDER, DEFAULT_DEEPSEEK_PROVIDER);
}

if (Meteor.isServer) {
  Meteor.startup(async () => {
    await ensureDefaultSettings();
    const resetUrl = await resetLMStudioBaseUrlInDb();
    console.log("[settings] lmStudioBaseUrl.reset", { baseUrl: resetUrl });
  });

  Meteor.publish("settings.default", function publishDefaultSettings() {
    return AppSettings.find(
      { _id: DEFAULT_SETTINGS_ID },
      {
        fields: {
          aiProviders: 1,
          activeAIProviderId: 1,
          communicationChannels: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );
  });

  Meteor.methods({
    async "settings.resetLMStudioBaseUrl"() {
      return resetLMStudioBaseUrlInDb();
    },

    async "settings.upsertAIProvider"(provider) {
      check(
        provider,
        {
          id: String,
          name: String,
          type: String,
          baseUrl: String,
          model: Match.Maybe(String),
          apiKey: Match.Maybe(String),
          enabled: Boolean,
        },
      );

      await ensureDefaultSettings();

      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const nextProviders = normalizeProviders(current && current.aiProviders);
      const nextProvider = normalizeProvider(provider, provider.type === "deepseek"
        ? DEFAULT_DEEPSEEK_PROVIDER
        : DEFAULT_LM_STUDIO_PROVIDER);

      const index = nextProviders.findIndex((item) => item && item.id === nextProvider.id);
      if (index === -1) {
        nextProviders.push(nextProvider);
      } else {
        nextProviders[index] = nextProvider;
      }

      await AppSettings.updateAsync(
        { _id: DEFAULT_SETTINGS_ID },
        {
          $set: {
            aiProviders: nextProviders,
            updatedAt: new Date(),
          },
        },
      );
    },

    async "settings.setActiveAIProvider"(providerId) {
      check(providerId, String);

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const providers = normalizeProviders(current && current.aiProviders);
      const exists = providers.some((item) => item && item.id === providerId);
      if (!exists) {
        throw new Meteor.Error("provider-not-found", "AI provider not found");
      }

      await AppSettings.updateAsync(
        { _id: DEFAULT_SETTINGS_ID },
        {
          $set: {
            activeAIProviderId: String(providerId),
            updatedAt: new Date(),
          },
        },
      );
    },

    async "settings.addCommunicationChannel"(type) {
      check(type, Match.OneOf("gmail", "whatsapp"));

      await ensureDefaultSettings();

      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const nextChannels = Array.isArray(current && current.communicationChannels)
        ? [...current.communicationChannels]
        : [];
      const existing = nextChannels.find((item) => item && item.type === type);
      if (!existing) {
        nextChannels.push({
          id: `${type}-${Date.now()}`,
          type,
          label: type === "gmail" ? "Gmail" : "WhatsApp",
          status: "pending",
          createdAt: new Date(),
        });
      }

      await AppSettings.updateAsync(
        { _id: DEFAULT_SETTINGS_ID },
        {
          $set: {
            communicationChannels: nextChannels,
            updatedAt: new Date(),
          },
        },
      );
    },
  });
}
