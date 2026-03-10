import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const execFile = promisify(execFileCallback);
const APP_ROOT = process.env.PWD || path.resolve(process.cwd(), "..", "..", "..", "..");
const FILE_CONVERTER_BIN = path.join(APP_ROOT, "server", "tools", "file-converter", "file-converter");
const FILE_CONVERTER_TIMEOUT_MS = 60_000;
const FILE_CONVERTER_MAX_BYTES = 20 * 1024 * 1024;

function sanitizeFilename(name) {
  const raw = String(name || "attachment");
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") return "attachment";
  return cleaned;
}

function isTextLikeMime(type) {
  const mime = String(type || "").toLowerCase();
  return (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    mime.includes("yaml") ||
    mime.includes("csv") ||
    mime.includes("markdown")
  );
}

function isTextLikeFilename(name) {
  const normalized = String(name || "").toLowerCase();
  return /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|js|jsx|ts|tsx|html|htm|css|sql|py|rb|java|c|cc|cpp|h|hpp)$/i.test(
    normalized,
  );
}

function decodeUtf8Fallback(buffer) {
  try {
    const text = Buffer.from(buffer || []).toString("utf8");
    return String(text || "").replace(/\u0000/g, "").trim();
  } catch (error) {
    return "";
  }
}

async function runFileConverter(tempFilePath) {
  const parsed = path.parse(tempFilePath);
  const markdownFilePath = path.join(parsed.dir, `${parsed.name}.converted.md`);

  try {
    await execFile(FILE_CONVERTER_BIN, ["convert", tempFilePath, "--output", markdownFilePath], {
      timeout: FILE_CONVERTER_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
    const markdown = String(await fs.readFile(markdownFilePath, "utf8")).trim();
    if (markdown) {
      return markdown;
    }
  } catch (error) {
    console.log("[files] converter.output_error", {
      message: error && error.message ? error.message : String(error),
    });
  }

  try {
    const { stdout } = await execFile(FILE_CONVERTER_BIN, ["convert", tempFilePath, "--stdout"], {
      timeout: FILE_CONVERTER_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });
    const markdown = String(stdout || "").trim();
    if (markdown) {
      return markdown;
    }
  } catch (error) {
    console.log("[files] converter.stdout_error", {
      message: error && error.message ? error.message : String(error),
    });
  }

  return "";
}

export async function extractFileContentWithConverter({ fileName, mimeType, base64Data }) {
  const normalizedName = String(fileName || "attachment");
  const decoded = Buffer.from(String(base64Data || ""), "base64");
  if (!decoded.length) {
    throw new Meteor.Error("files-empty", "Attached file is empty");
  }
  if (decoded.length > FILE_CONVERTER_MAX_BYTES) {
    throw new Meteor.Error("files-too-large", "Attached file exceeds 20 MB");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "metacells-file-"));
  const tempFilePath = path.join(tempDir, `${randomUUID()}-${sanitizeFilename(fileName)}`);

  try {
    await fs.writeFile(tempFilePath, decoded);

    const converted = await runFileConverter(tempFilePath);
    if (converted) {
      console.log("[files] converter.content", {
        name: normalizedName,
        type: String(mimeType || ""),
        length: converted.length,
        preview: converted.slice(0, 1000),
      });
      return converted;
    }

    if (isTextLikeMime(mimeType) || isTextLikeFilename(normalizedName)) {
      const textFallback = decodeUtf8Fallback(decoded);
      if (textFallback) {
        console.log("[files] converter.fallback_text", {
          name: normalizedName,
          type: String(mimeType || ""),
          length: textFallback.length,
          preview: textFallback.slice(0, 1000),
        });
        return textFallback;
      }
    }

    console.log("[files] converter.fallback_placeholder", {
      name: normalizedName,
      type: String(mimeType || ""),
    });
    return `[Attached file: ${normalizedName}]`;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

if (Meteor.isServer) {
  Meteor.methods({
    async "files.extractContent"(fileName, mimeType, base64Data) {
      check(fileName, String);
      check(mimeType, String);
      check(base64Data, String);

      const content = await extractFileContentWithConverter({
        fileName,
        mimeType,
        base64Data,
      });

      return {
        name: fileName,
        type: mimeType,
        content,
      };
    },
  });
}
