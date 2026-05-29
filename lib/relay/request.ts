import { getEnv } from "@/lib/env";
import { RelayError } from "@/lib/internal/errors";

export async function readJsonWithLimit(request: Request): Promise<unknown> {
  const maxBytes = getEnv().RELAY_MAX_REQUEST_BODY_BYTES;
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new RelayError({
      type: "invalid_request_error",
      message: `Request body exceeds ${maxBytes} bytes`,
      status: 413,
    });
  }

  const reader = request.body?.getReader();
  if (!reader) return {};

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new RelayError({
        type: "invalid_request_error",
        message: `Request body exceeds ${maxBytes} bytes`,
        status: 413,
      });
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new RelayError({
      type: "invalid_request_error",
      message: "Request body must be valid JSON",
      status: 400,
    });
  }
}
