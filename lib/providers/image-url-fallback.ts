import { convertImageUrlsToBase64, hasUrlImageSource } from "@/lib/internal/images";
import type { InternalChatRequest } from "@/lib/internal/types";

type SendProviderRequest = (request: InternalChatRequest) => Promise<Response>;

function shouldRetryImageUrlAsBase64(response: Response): boolean {
  return response.status === 400 || response.status === 415 || response.status === 422;
}

export async function fetchWithImageUrlFallback(
  request: InternalChatRequest,
  timeoutMs: number,
  send: SendProviderRequest,
): Promise<Response> {
  const response = await send(request);
  if (response.ok || !hasUrlImageSource(request) || !shouldRetryImageUrlAsBase64(response)) return response;

  const fallbackRequest = await convertImageUrlsToBase64(request, timeoutMs);
  if (fallbackRequest === request) return response;
  return send(fallbackRequest);
}
