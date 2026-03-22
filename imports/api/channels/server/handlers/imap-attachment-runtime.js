import { randomUUID } from 'node:crypto';
import { extractFileContentWithConverter } from '../../../files/index.js';
import {
  createBinaryArtifact,
  createTextArtifact,
} from '../../../artifacts/index.js';
import { formatNestedError, streamToBuffer } from './imap-shared-runtime.js';

function collectAttachmentParts(node, result) {
  const target = Array.isArray(result) ? result : [];
  const source = node && typeof node === 'object' ? node : null;
  if (!source) return target;

  const disposition = String(source.disposition || '')
    .trim()
    .toLowerCase();
  const filename = String(
    (source.dispositionParameters && source.dispositionParameters.filename) ||
      (source.parameters && source.parameters.name) ||
      '',
  ).trim();
  const type = String(source.type || '')
    .trim()
    .toLowerCase();
  const subtype = String(source.subtype || '')
    .trim()
    .toLowerCase();
  const isAttachment =
    !!String(source.part || '').trim() &&
    (disposition === 'attachment' ||
      (disposition === 'inline' && filename) ||
      (!!filename && type !== 'multipart'));

  if (isAttachment) {
    target.push({
      part: String(source.part || '').trim(),
      filename: filename || `attachment-${target.length + 1}`,
      type:
        [type, subtype].filter(Boolean).join('/') || 'application/octet-stream',
      size: Number(source.size) || 0,
      disposition: disposition || 'attachment',
    });
  }

  if (Array.isArray(source.childNodes)) {
    source.childNodes.forEach((child) => collectAttachmentParts(child, target));
  }

  return target;
}

export async function fetchMessageAttachments(client, uid, bodyStructure) {
  const parts = collectAttachmentParts(bodyStructure, []);
  if (!parts.length) return [];

  const attachments = [];
  for (let i = 0; i < parts.length; i += 1) {
    const item = parts[i];
    try {
      const download = await client.download(String(uid), item.part, {
        uid: true,
      });
      const content = await streamToBuffer(download.content, 2 * 1024 * 1024);
      const base64 = content.toString('base64');
      let extractedContent = '';
      try {
        extractedContent = await extractFileContentWithConverter({
          fileName: item.filename,
          mimeType: item.type,
          base64Data: base64,
        });
      } catch (error) {
        extractedContent = '';
      }
      const owner = {
        ownerType: 'channel-event-attachment',
        ownerId: `${String(uid)}:${String(item.part || '')}`,
      };
      const binaryArtifact = await createBinaryArtifact({
        base64Data: base64,
        mimeType: item.type,
        fileName: item.filename,
        owner,
      });
      const contentArtifact = extractedContent
        ? await createTextArtifact({
            text: String(extractedContent || ''),
            mimeType: 'text/plain; charset=utf-8',
            fileName: `${String(item.filename || 'attachment')}.txt`,
            owner,
          })
        : null;
      attachments.push({
        id: randomUUID(),
        name: item.filename,
        type: item.type,
        size: content.length || item.size,
        disposition: item.disposition,
        binaryArtifactId: String((binaryArtifact && binaryArtifact._id) || ''),
        contentArtifactId: String(
          (contentArtifact && contentArtifact._id) || '',
        ),
      });
    } catch (error) {
      attachments.push({
        id: randomUUID(),
        name: item.filename,
        type: item.type,
        size: item.size,
        disposition: item.disposition,
        error: formatNestedError(error) || 'Failed to download attachment',
      });
    }
  }

  return attachments;
}
