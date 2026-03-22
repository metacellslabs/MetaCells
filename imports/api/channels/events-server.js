import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { getArtifactText } from '../artifacts/index.js';
import { ChannelEvents } from './events.js';
import { getArtifactBinary } from '../artifacts/index.js';

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i,
  );
  if (!match) return null;
  const mimeType = String(match[1] || 'application/octet-stream');
  const isBase64 = !!match[2];
  const payload = String(match[3] || '');
  try {
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    return { mimeType, buffer };
  } catch (error) {
    return null;
  }
}

function contentDisposition(fileName) {
  const raw = String(fileName || 'attachment').replace(/[\r\n"]/g, '_');
  return `inline; filename="${raw}"`;
}

function isSafeInternalPath(value) {
  const text = String(value || '').trim();
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(text);
}

export function registerChannelEventAttachmentRoute() {
  if (!Meteor.isServer) return;

  WebApp.rawConnectHandlers.use(async (req, res, next) => {
    const url = String(req.url || '');
    const match = url.match(
      /^\/channel-events\/([^/]+)\/attachments\/([^/?#]+)/,
    );
    if (!match) {
      next();
      return;
    }

    try {
      const eventId = decodeURIComponent(match[1]);
      const attachmentId = decodeURIComponent(match[2]);
      const eventDoc = await ChannelEvents.findOneAsync({ _id: eventId });
      const attachments = Array.isArray(eventDoc && eventDoc.attachments)
        ? eventDoc.attachments
        : [];
      const attachment = attachments.find((item, index) => {
        const currentId = String(
          item && (item.id || item.attachmentId)
            ? item.id || item.attachmentId
            : `legacy-${index}`,
        );
        return currentId === attachmentId;
      });
      const binary =
        attachment && attachment.binaryArtifactId
          ? await getArtifactBinary(String(attachment.binaryArtifactId || ''))
          : null;
      const textContent =
        !binary && attachment && attachment.contentArtifactId
          ? await getArtifactText(String(attachment.contentArtifactId || ''))
          : '';
      const legacy =
        !binary && attachment && attachment.downloadUrl
          ? decodeDataUrl(attachment.downloadUrl)
          : null;
      const preview =
        !binary && !legacy && attachment && attachment.previewUrl
          ? decodeDataUrl(attachment.previewUrl)
          : null;

      const served = binary || legacy || preview;

      if (
        attachment &&
        !served &&
        String(textContent || '') !== ''
      ) {
        const body = Buffer.from(String(textContent || ''), 'utf8');
        res.statusCode = 200;
        res.setHeader(
          'Content-Type',
          String(attachment.type || 'text/plain; charset=utf-8') ||
            'text/plain; charset=utf-8',
        );
        res.setHeader('Content-Length', String(body.length));
        res.setHeader('Content-Disposition', contentDisposition(attachment.name));
        res.end(body);
        return;
      }

      if (
        attachment &&
        !served &&
        attachment.previewUrl &&
        String(attachment.previewUrl) !== String(req.url || '') &&
        String(attachment.previewUrl) !==
          `/channel-events/${encodeURIComponent(eventId)}/attachments/${encodeURIComponent(attachmentId)}`
      ) {
        const target = String(attachment.previewUrl || '').trim();
        if (/^https?:\/\//i.test(target) || isSafeInternalPath(target)) {
          res.statusCode = 302;
          res.setHeader('Location', target);
          res.end();
          return;
        }
      }

      if (!attachment || !served || !served.buffer || !served.buffer.length) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Attachment not found');
        return;
      }

      res.statusCode = 200;
      res.setHeader(
        'Content-Type',
        served.mimeType ||
          String(attachment.type || 'application/octet-stream'),
      );
      res.setHeader('Content-Length', String(served.buffer.length));
      res.setHeader('Content-Disposition', contentDisposition(attachment.name));
      res.end(served.buffer);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Failed to serve attachment');
    }
  });
}
