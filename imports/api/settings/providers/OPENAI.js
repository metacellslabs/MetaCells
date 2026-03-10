import { defineAIProvider } from "./definition.js";

export default defineAIProvider({
  id: "openai",
  name: "OpenAI",
  type: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  apiKey: "",
  enabled: true,
  availableModels: [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
  ],
  fields: [
    { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://api.openai.com/v1" },
    { key: "model", label: "Model", type: "text", placeholder: "gpt-4.1-mini" },
    { key: "apiKey", label: "API key", type: "password", placeholder: "sk-..." },
  ],
});
