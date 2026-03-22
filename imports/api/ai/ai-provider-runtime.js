import {
  getActiveAIProvider,
  getLMStudioBaseUrl,
} from '../settings/index.js';

let cachedModel = null;

export function providerSupportsImageInput(provider, model) {
  const providerType = String(provider && provider.type ? provider.type : '')
    .trim()
    .toLowerCase();
  const modelName = String(model || provider?.model || '')
    .trim()
    .toLowerCase();
  if (!providerType || !modelName) return false;
  if (providerType === 'deepseek') {
    return modelName.includes('vl') || modelName.includes('vision');
  }
  if (providerType === 'openai') {
    return modelName.includes('gpt-4o') || modelName.includes('gpt-4.1');
  }
  if (providerType === 'lm_studio') {
    return (
      modelName.includes('vision') ||
      modelName.includes('vl') ||
      modelName.includes('llava')
    );
  }
  return false;
}

export function stripUnsupportedImageParts(messages) {
  return Array.isArray(messages)
    ? messages.map((message) => {
        const source = message && typeof message === 'object' ? message : {};
        const content = source.content;
        if (!Array.isArray(content)) {
          return {
            role: source.role,
            content,
          };
        }
        const text = content
          .map((part) => {
            if (typeof part === 'string') return part;
            if (!part || typeof part !== 'object') return '';
            if (part.type === 'text')
              return String(part.text == null ? '' : part.text);
            return '';
          })
          .join('\n\n')
          .trim();
        return {
          role: source.role,
          content: text,
        };
      })
    : [];
}

export function buildOpenAIResponsesInput(messages) {
  const source = Array.isArray(messages) ? messages : [];
  return source.map((message) => {
    const item = message && typeof message === 'object' ? message : {};
    const input = Array.isArray(item.content)
      ? item.content
          .map((part) => {
            if (!part || typeof part !== 'object') return null;
            if (part.type === 'text') {
              return {
                type: 'input_text',
                text: String(part.text == null ? '' : part.text),
              };
            }
            if (part.type === 'image_url' && part.image_url && part.image_url.url) {
              return {
                type: 'input_image',
                image_url: String(part.image_url.url || ''),
              };
            }
            return null;
          })
          .filter(Boolean)
      : [
          {
            type: 'input_text',
            text: String(item.content == null ? '' : item.content),
          },
        ];
    return {
      role: String(item.role || 'user'),
      content: input,
    };
  });
}

export function extractOpenAIResponsesText(payload) {
  const output = Array.isArray(payload && payload.output) ? payload.output : [];
  return output
    .flatMap((item) =>
      Array.isArray(item && item.content) ? item.content : [],
    )
    .filter((part) => part && part.type === 'output_text')
    .map((part) => String(part.text == null ? '' : part.text))
    .join('');
}

export async function fetchModelFromServer(log) {
  const provider = await getActiveAIProvider();
  const providerKey = [provider.type, provider.baseUrl, provider.model].join(
    '|',
  );
  if (cachedModel && cachedModel.providerKey === providerKey) {
    log('model.cache_hit', {
      model: cachedModel.model,
      provider: provider.type,
    });
    return cachedModel.model;
  }

  if (provider.type === 'deepseek') {
    const model = String(provider.model || 'deepseek-chat');
    cachedModel = { providerKey, model };
    log('model.provider_default', { model, provider: provider.type });
    return model;
  }

  if (provider.type === 'openai') {
    const model = String(provider.model || 'gpt-4.1-mini');
    cachedModel = { providerKey, model };
    log('model.provider_default', { model, provider: provider.type });
    return model;
  }

  if (provider.type === 'lm_studio' && provider.model) {
    const model = String(provider.model);
    cachedModel = { providerKey, model };
    log('model.provider_override', { model, provider: provider.type });
    return model;
  }

  const lmStudioBaseUrl =
    provider.type === 'lm_studio'
      ? provider.baseUrl
      : await getLMStudioBaseUrl();
  log('model.fetch.start', {
    provider: provider.type,
    baseUrl: lmStudioBaseUrl,
  });

  try {
    const response = await fetch(`${lmStudioBaseUrl}/models`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const model = data && data.data && data.data[0] && data.data[0].id;
    cachedModel = { providerKey, model: model || 'local-model' };
    log('model.fetch.success', {
      model: cachedModel.model,
      provider: provider.type,
    });
    return cachedModel.model;
  } catch (error) {
    cachedModel = { providerKey, model: 'local-model' };
    log('model.fetch.fallback', {
      error: error.message,
      model: cachedModel.model,
      provider: provider.type,
    });
    return cachedModel.model;
  }
}
