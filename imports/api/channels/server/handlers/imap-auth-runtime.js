import { formatNestedError, logChannelTest } from './imap-shared-runtime.js';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function validateImapSettings(settings) {
  const host = String(settings.host || '').trim();
  const username = String(settings.username || '').trim();
  const password = String(settings.password || '');
  const mailbox = String(settings.mailbox || 'INBOX').trim() || 'INBOX';

  if (!host) {
    throw new Error('IMAP host is required');
  }
  if (!username) {
    throw new Error('IMAP username is required');
  }
  if (!password && !usesOAuth(settings)) {
    throw new Error('IMAP password is required');
  }

  return { host, username, password, mailbox };
}

export function validateSmtpSettings(settings) {
  const host = String(settings.smtpHost || '').trim();
  const username = String(
    settings.smtpUsername || settings.username || '',
  ).trim();
  const password = String(settings.smtpPassword || settings.password || '');
  const from = String(settings.from || settings.username || '').trim();

  if (!host) {
    throw new Error('SMTP host is required');
  }
  if (!username) {
    throw new Error('SMTP username is required');
  }
  if (!password && !usesOAuth(settings)) {
    throw new Error('SMTP password is required');
  }
  if (!from) {
    throw new Error('SMTP from address is required');
  }

  return { host, username, password, from };
}

export function usesOAuth(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return (
    source.useOAuth === true ||
    (!!String(source.oauthRefreshToken || '').trim() &&
      !!String(source.oauthClientId || '').trim())
  );
}

async function fetchGoogleOAuthAccessToken(settings, username) {
  const clientId = String(settings.oauthClientId || '').trim();
  const clientSecret = String(settings.oauthClientSecret || '').trim();
  const refreshToken = String(settings.oauthRefreshToken || '').trim();
  const fallbackAccessToken = String(settings.oauthAccessToken || '').trim();
  const user = String(username || settings.username || '').trim();

  if (!clientId) {
    throw new Error('OAuth client ID is required');
  }
  if (!clientSecret) {
    throw new Error('OAuth client secret is required');
  }
  if (!refreshToken) {
    if (fallbackAccessToken) {
      return { accessToken: fallbackAccessToken, expiresAt: null };
    }
    throw new Error('OAuth refresh token is required');
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const text = String(await response.text()).trim();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = {};
  }
  if (!response.ok) {
    throw new Error(
      (data && (data.error_description || data.error)) ||
        text ||
        `OAuth token request failed with HTTP ${response.status}`,
    );
  }
  const accessToken = String(
    (data && (data.access_token || data.accessToken)) || fallbackAccessToken || '',
  ).trim();
  if (!accessToken) {
    throw new Error('OAuth token response did not include access_token');
  }
  logChannelTest('oauth.token.success', {
    username: user,
    expiresIn: Number(data && data.expires_in) || 0,
  });
  return {
    accessToken,
    expiresAt:
      Number(data && data.expires_in) > 0
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null,
  };
}

export async function buildEmailAuth(settings, username) {
  if (!usesOAuth(settings)) {
    return {
      mode: 'password',
      auth: {
        user: String(username || '').trim(),
        pass: String(settings.password || '').trim(),
      },
      smtpAuth: {
        user: String(settings.smtpUsername || settings.username || '').trim(),
        pass: String(settings.smtpPassword || settings.password || '').trim(),
      },
      token: null,
    };
  }

  const token = await fetchGoogleOAuthAccessToken(settings, username);
  return {
    mode: 'oauth',
    auth: {
      user: String(username || '').trim(),
      accessToken: token.accessToken,
    },
    smtpAuth: {
      type: 'OAuth2',
      user: String(settings.smtpUsername || settings.username || '').trim(),
      clientId: String(settings.oauthClientId || '').trim(),
      clientSecret: String(settings.oauthClientSecret || '').trim(),
      refreshToken: String(settings.oauthRefreshToken || '').trim(),
      accessToken: token.accessToken,
    },
    token,
  };
}

export function formatImapConnectionError(error) {
  return formatNestedError(error) || 'Failed to connect to email channel';
}
