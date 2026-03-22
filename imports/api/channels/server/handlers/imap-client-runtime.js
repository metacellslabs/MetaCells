import { defineChannelHandler } from '../handler-definition.js';
import { fetchMessageAttachments } from './imap-attachment-runtime.js';
import {
  buildEmailAuth,
  formatImapConnectionError,
  validateImapSettings,
  validateSmtpSettings,
} from './imap-auth-runtime.js';
import {
  decodeMessageSource,
  formatNestedError,
  logChannelTest,
  normalizeAddressList,
} from './imap-shared-runtime.js';

export async function testImapConnection(settings) {
  const { host, username, mailbox } = validateImapSettings(settings);
  const smtp = validateSmtpSettings(settings);
  const authBundle = await buildEmailAuth(settings, username);

  const { ImapFlow } = await import('imapflow');
  const nodemailer = await import('nodemailer');
  const client = new ImapFlow({
    host,
    port: Number(settings.port || 993) || 993,
    secure: settings.secure !== false,
    auth: authBundle.auth,
    logger: false,
  });

  try {
    try {
      logChannelTest('imap.connect.start', {
        host,
        port: Number(settings.port || 993) || 993,
        secure: settings.secure !== false,
        username,
        authMode: authBundle.mode,
      });
      await client.connect();
      logChannelTest('imap.connect.success', {
        host,
        port: Number(settings.port || 993) || 993,
      });

      logChannelTest('imap.mailbox.open.start', {
        host,
        mailbox,
      });
      await client.mailboxOpen(mailbox);
      logChannelTest('imap.mailbox.open.success', {
        host,
        mailbox,
      });

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(settings.smtpPort || 465) || 465,
        secure: settings.smtpSecure !== false,
        auth: authBundle.smtpAuth,
      });
      logChannelTest('smtp.verify.start', {
        host: smtp.host,
        port: Number(settings.smtpPort || 465) || 465,
        secure: settings.smtpSecure !== false,
        username: smtp.username,
        from: smtp.from,
        authMode: authBundle.mode,
      });
      await transporter.verify();
      logChannelTest('smtp.verify.success', {
        host: smtp.host,
        port: Number(settings.smtpPort || 465) || 465,
      });
    } catch (error) {
      const message = formatImapConnectionError(error);
      logChannelTest('test.failed', {
        message,
        imap: {
          host,
          port: Number(settings.port || 993) || 993,
          secure: settings.secure !== false,
          mailbox,
          username,
          authMode: authBundle.mode,
        },
        smtp: {
          host: smtp.host,
          port: Number(settings.smtpPort || 465) || 465,
          secure: settings.smtpSecure !== false,
          username: smtp.username,
          from: smtp.from,
          authMode: authBundle.mode,
        },
      });
      throw new Error(message);
    }
    logChannelTest('test.success', {
      imapHost: host,
      mailbox,
      smtpHost: smtp.host,
    });
    return {
      ok: true,
      message: `Connected to IMAP ${host}/${mailbox} and SMTP ${String(settings.smtpHost || '').trim()}`,
    };
  } finally {
    try {
      await client.logout();
    } catch (error) {}
  }
}

export async function sendImapMessage(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const settings =
    source.settings && typeof source.settings === 'object'
      ? source.settings
      : {};
  const smtp = validateSmtpSettings(settings);
  const authBundle = await buildEmailAuth(settings, smtp.username);
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(settings.smtpPort || 465) || 465,
    secure: settings.smtpSecure !== false,
    auth: authBundle.smtpAuth,
  });

  const to = Array.isArray(source.to) ? source.to.filter(Boolean) : [];
  if (!to.length) {
    throw new Error('Email send requires at least one recipient');
  }

  const attachments = Array.isArray(source.attachments)
    ? source.attachments
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          filename: String(item.name || 'attachment'),
          content: String(item.content || ''),
          contentType: String(item.type || 'text/plain'),
        }))
    : [];

  const info = await transporter.sendMail({
    from: smtp.from,
    to,
    subject: String(source.subj || ''),
    text: String(source.body || ''),
    attachments,
  });

  return {
    ok: true,
    messageId: String((info && info.messageId) || ''),
    accepted: Array.isArray(info && info.accepted) ? info.accepted : [],
  };
}

export async function handleImapEvent(event, message) {
  return {
    event: String(event || ''),
    message: message && typeof message === 'object' ? message : {},
  };
}

async function fetchImapEventsSince({
  client,
  channel,
  mailbox,
  lastSeenUid,
}) {
  const events = [];
  const mailboxState = client.mailbox || {};
  const nextUid = Number(mailboxState.uidNext) || 0;
  const rangeStart = Math.max(1, Number(lastSeenUid) + 1 || 1);

  logChannelTest('poll.mailbox.opened', {
    mailbox,
    exists: Number(mailboxState.exists) || 0,
    uidNext: nextUid,
    rangeStart,
  });

  if (!lastSeenUid && nextUid > 1) {
    const baselineUid = Math.max(0, nextUid - 1);
    logChannelTest('poll.baseline_set', {
      mailbox,
      baselineUid,
      reason: 'no-lastSeenUid',
    });
    return {
      lastSeenUid: baselineUid,
      events,
    };
  }

  if (nextUid && rangeStart >= nextUid) {
    logChannelTest('poll.no_new_mail', {
      mailbox,
      lastSeenUid,
      uidNext: nextUid,
    });
    return {
      lastSeenUid,
      events,
    };
  }

  let uids = [];
  try {
    const searchResult = await client.search(
      { uid: `${rangeStart}:*` },
      { uid: true },
    );
    uids = Array.isArray(searchResult)
      ? searchResult.map((value) => Number(value) || 0).filter(Boolean)
      : [];
    logChannelTest('poll.search.result', {
      mailbox,
      range: `${rangeStart}:*`,
      count: uids.length,
      uids,
    });
  } catch (error) {
    logChannelTest('poll.search_failed', {
      message: formatNestedError(error),
      mailbox,
      rangeStart,
    });
    throw error;
  }

  uids.sort((left, right) => left - right);

  for (let i = 0; i < uids.length; i += 1) {
    const uid = uids[i];
    const message = await client.fetchOne(
      String(uid),
      {
        uid: true,
        envelope: true,
        internalDate: true,
        bodyStructure: true,
        source: { start: 0, maxLength: 128000 },
      },
      { uid: true },
    );
    if (!message) continue;

    const attachments = await fetchMessageAttachments(
      client,
      uid,
      message.bodyStructure,
    );

    const payload = {
      channelId: String((channel && channel.id) || ''),
      label: String((channel && channel.label) || ''),
      connectorId: String((channel && channel.connectorId) || 'imap-email'),
      event: 'message.new',
      mailbox,
      uid: Number(message.uid || uid) || uid,
      subject: String(
        (message.envelope && message.envelope.subject) || '',
      ).trim(),
      from: normalizeAddressList(message.envelope && message.envelope.from),
      to: normalizeAddressList(message.envelope && message.envelope.to),
      date:
        message.internalDate instanceof Date
          ? message.internalDate.toISOString()
          : '',
      text: decodeMessageSource(message.source),
      attachments,
    };
    events.push(payload);
    logChannelTest('poll.event', {
      mailbox,
      uid: payload.uid,
      subject: payload.subject,
      from: payload.from,
      date: payload.date,
      textPreview: String(payload.text || '').slice(0, 240),
      attachments: attachments.map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
        hasDownloadUrl: !!item.downloadUrl,
        hasContent: !!item.content,
        error: item.error || '',
      })),
    });
  }

  return {
    lastSeenUid: uids.length ? uids[uids.length - 1] : lastSeenUid,
    events,
  };
}

export async function pollImapMessages(settings, channel) {
  const { host, username, mailbox } = validateImapSettings(settings);
  const authBundle = await buildEmailAuth(settings, username);
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host,
    port: Number(settings.port || 993) || 993,
    secure: settings.secure !== false,
    auth: authBundle.auth,
    logger: false,
  });

  const lastSeenUid = Number(channel && channel.lastSeenUid) || 0;

  try {
    logChannelTest('poll.start', {
      channelId: String((channel && channel.id) || ''),
      label: String((channel && channel.label) || ''),
      host,
      mailbox,
      lastSeenUid,
    });

    await client.connect();
    const lock = await client.mailboxOpen(mailbox);
    const nextUid = Number(lock && lock.uidNext) || 0;
    const rangeStart = Math.max(1, lastSeenUid + 1);
    logChannelTest('poll.mailbox.opened', {
      mailbox,
      exists: Number(lock && lock.exists) || 0,
      uidNext: nextUid,
      rangeStart,
    });

    if (!lastSeenUid && nextUid > 1) {
      const baselineUid = Math.max(0, nextUid - 1);
      logChannelTest('poll.baseline_set', {
        mailbox,
        baselineUid,
        reason: 'no-lastSeenUid',
      });
      return {
        ok: true,
        lastSeenUid: baselineUid,
        events: [],
      };
    }

    if (nextUid && rangeStart >= nextUid) {
      logChannelTest('poll.no_new_mail', {
        mailbox,
        lastSeenUid,
        uidNext: nextUid,
      });
      return {
        ok: true,
        lastSeenUid,
        events: [],
      };
    }

    const result = await fetchImapEventsSince({
      client,
      channel,
      mailbox,
      lastSeenUid,
    });

    logChannelTest('poll.success', {
      mailbox,
      count: result.events.length,
      lastSeenUid: result.lastSeenUid,
      subjects: result.events.map((event) => String(event.subject || '')).slice(0, 10),
    });

    return {
      ok: true,
      lastSeenUid: result.lastSeenUid,
      events: result.events,
    };
  } finally {
    try {
      await client.logout();
    } catch (error) {}
  }
}

export async function subscribeImapMessages({
  settings,
  channel,
  onEvent,
  onError,
  onState,
}) {
  const { host, username, mailbox } = validateImapSettings(settings);
  const authBundle = await buildEmailAuth(settings, username);
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host,
    port: Number(settings.port || 993) || 993,
    secure: settings.secure !== false,
    auth: authBundle.auth,
    logger: false,
  });

  let stopped = false;
  let currentLastSeenUid = Number(channel && channel.lastSeenUid) || 0;
  let queue = Promise.resolve();

  const reportError = (error) => {
    if (stopped || typeof onError !== 'function') return;
    onError(error);
  };

  const processNewMail = () => {
    queue = queue
      .catch(() => {})
      .then(async () => {
        if (stopped) return;
        const result = await fetchImapEventsSince({
          client,
          channel,
          mailbox,
          lastSeenUid: currentLastSeenUid,
        });
        currentLastSeenUid =
          Number(result && result.lastSeenUid) || currentLastSeenUid;
        if (typeof onState === 'function') {
          await onState({ lastSeenUid: currentLastSeenUid });
        }
        const events = Array.isArray(result && result.events) ? result.events : [];
        for (let i = 0; i < events.length; i += 1) {
          const payload = events[i];
          if (typeof onEvent === 'function') {
            await onEvent({
              payload,
              nextUid: Number(payload && payload.uid) || currentLastSeenUid,
            });
          }
        }
      })
      .catch(reportError);
    return queue;
  };

  await client.connect();
  await client.mailboxOpen(mailbox);

  logChannelTest('subscribe.start', {
    channelId: String((channel && channel.id) || ''),
    label: String((channel && channel.label) || ''),
    host,
    mailbox,
    lastSeenUid: currentLastSeenUid,
    authMode: authBundle.mode,
  });

  await processNewMail();

  const handleExists = () => {
    processNewMail().catch(reportError);
  };
  const handleError = (error) => {
    reportError(error);
  };
  const handleClose = () => {
    reportError(new Error('IMAP channel connection closed'));
  };

  client.on('exists', handleExists);
  client.on('error', handleError);
  client.on('close', handleClose);

  return async () => {
    stopped = true;
    client.off('exists', handleExists);
    client.off('error', handleError);
    client.off('close', handleClose);
    try {
      await client.logout();
    } catch (error) {}
  };
}

export const IMAP_HANDLER = defineChannelHandler({
  id: 'imap-email',
  name: 'IMAP Email',
  summary: 'Email channel over IMAP/SMTP with polling, send, attachments, and OAuth support.',
  docs: [
    'https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list',
    'https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get',
    'https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send',
  ],
  popularMethods: [
    'messages.list',
    'messages.get',
    'messages.send',
    'threads.list',
  ],
  capabilities: {
    test: true,
    send: true,
    receive: true,
    poll: true,
    subscribe: true,
    normalizeEvent: true,
    search: true,
    attachments: true,
    oauth: true,
    actions: ['test', 'send', 'poll', 'search'],
    entities: ['message', 'thread', 'attachment'],
  },
  testConnection: async ({ settings }) => testImapConnection(settings),
  send: async ({ settings, payload }) =>
    sendImapMessage({ ...(payload || {}), settings }),
  poll: async ({ settings, channel }) => pollImapMessages(settings, channel),
  subscribe: async ({ settings, channel, onEvent, onError, onState }) =>
    subscribeImapMessages({ settings, channel, onEvent, onError, onState }),
  normalizeEvent: async ({ eventType, payload }) =>
    handleImapEvent(eventType, payload),
});
