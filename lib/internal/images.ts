import net from "node:net";
import { getEnv } from "@/lib/env";
import { RelayError } from "@/lib/internal/errors";
import type { InternalChatRequest, InternalContentBlock, InternalImageSource } from "@/lib/internal/types";

const dataUrlPattern = /^data:([^;,]+);base64,(.*)$/i;
const maxFetchedImageBytes = 5_000_000;
const supportedMediaTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function imageSourceFromOpenAIUrl(url: string): InternalImageSource {
  const match = dataUrlPattern.exec(url);
  if (match) {
    return {
      type: "base64",
      mediaType: match[1] ?? "application/octet-stream",
      data: match[2] ?? "",
    };
  }
  return { type: "url", url };
}

export function imageSourceFromAnthropicSource(source: unknown): InternalImageSource | undefined {
  if (!source || typeof source !== "object") return undefined;

  const raw = source as Record<string, unknown>;
  if (raw.type === "base64" && typeof raw.media_type === "string" && typeof raw.data === "string") {
    return { type: "base64", mediaType: raw.media_type, data: raw.data };
  }
  if (raw.type === "url" && typeof raw.url === "string") {
    return { type: "url", url: raw.url };
  }
  if (raw.type === "file" && typeof raw.file_id === "string") {
    return { type: "file", fileId: raw.file_id };
  }

  return undefined;
}

export function imageSourceToOpenAIUrl(source: InternalImageSource): string | undefined {
  if (source.type === "url") return source.url;
  if (source.type === "base64") return `data:${source.mediaType};base64,${source.data}`;
  return undefined;
}

export function imageSourceToAnthropicSource(source: InternalImageSource): Record<string, string> {
  if (source.type === "url") return { type: "url", url: source.url };
  if (source.type === "base64") {
    return { type: "base64", media_type: source.mediaType, data: source.data };
  }
  return { type: "file", file_id: source.fileId };
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function assertPublicImageUrl(value: string): URL {
  const env = getEnv();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RelayError({ type: "invalid_request_error", message: "image url must be a valid URL", status: 400 });
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new RelayError({ type: "invalid_request_error", message: "image url must use http or https", status: 400 });
  }
  if (!env.ALLOW_INSECURE_PROVIDER_URLS && parsed.protocol !== "https:") {
    throw new RelayError({ type: "invalid_request_error", message: "image url must use https", status: 400 });
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1", "169.254.169.254"]);
  if (blockedHosts.has(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    throw new RelayError({ type: "invalid_request_error", message: "image url cannot target local hosts", status: 400 });
  }
  if (net.isIPv4(host) && isPrivateIPv4(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    throw new RelayError({ type: "invalid_request_error", message: "image url cannot target private IPv4 ranges", status: 400 });
  }
  if (net.isIPv6(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    const normalized = host.toLowerCase();
    if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      throw new RelayError({ type: "invalid_request_error", message: "image url cannot target private IPv6 ranges", status: 400 });
    }
  }

  return parsed;
}

function mediaTypeFromUrl(url: URL): string | undefined {
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".webp")) return "image/webp";
  return undefined;
}

export async function fetchImageUrlAsBase64Source(url: string, timeoutMs: number): Promise<InternalImageSource> {
  const parsed = assertPublicImageUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed, { signal: controller.signal });
    if (!response.ok) {
      throw new RelayError({
        type: "invalid_request_error",
        message: `image url returned HTTP ${response.status}`,
        status: 400,
      });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxFetchedImageBytes) {
      throw new RelayError({ type: "invalid_request_error", message: "image url is too large", status: 400 });
    }

    const headerMediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const mediaType = headerMediaType && supportedMediaTypes.has(headerMediaType) ? headerMediaType : mediaTypeFromUrl(parsed);
    if (!mediaType || !supportedMediaTypes.has(mediaType)) {
      throw new RelayError({
        type: "invalid_request_error",
        message: "image url must return jpeg, png, gif, or webp",
        status: 400,
      });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new RelayError({ type: "invalid_request_error", message: "image url returned an empty body", status: 400 });
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxFetchedImageBytes) {
        throw new RelayError({ type: "invalid_request_error", message: "image url is too large", status: 400 });
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    return { type: "base64", mediaType, data: buffer.toString("base64") };
  } catch (error) {
    if (error instanceof RelayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RelayError({ type: "provider_timeout", message: "image url fetch timed out", status: 504, retryable: true });
    }
    throw new RelayError({
      type: "invalid_request_error",
      message: error instanceof Error ? `image url fetch failed: ${error.message}` : "image url fetch failed",
      status: 400,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function hasUrlImageSource(request: InternalChatRequest): boolean {
  return request.messages.some((message) =>
    message.content.some((block) => block.type === "image" && block.source.type === "url"),
  );
}

async function imageBlockUrlToBase64(
  block: InternalContentBlock,
  timeoutMs: number,
): Promise<{ block: InternalContentBlock; changed: boolean }> {
  if (block.type !== "image" || block.source.type !== "url") return { block, changed: false };
  return {
    block: { type: "image", source: await fetchImageUrlAsBase64Source(block.source.url, Math.min(timeoutMs, 15000)) },
    changed: true,
  };
}

export async function convertImageUrlsToBase64(
  request: InternalChatRequest,
  timeoutMs: number,
): Promise<InternalChatRequest> {
  let changed = false;
  const messages = await Promise.all(
    request.messages.map(async (message) => {
      const content = await Promise.all(message.content.map((block) => imageBlockUrlToBase64(block, timeoutMs)));
      if (!content.some((item) => item.changed)) return message;
      changed = true;
      return { ...message, content: content.map((item) => item.block) };
    }),
  );

  return changed ? { ...request, messages } : request;
}
