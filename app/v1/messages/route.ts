import { authenticateRelayKey } from "@/lib/auth/relay-key";
import { jsonError } from "@/lib/internal/errors";
import { parseAnthropicRequest } from "@/lib/protocols/anthropic/parse-request";
import { formatAnthropicResponse } from "@/lib/protocols/anthropic/format-response";
import { createRelayStreamResponse, invokeWithFallback } from "@/lib/relay/execute";
import { readJsonWithLimit } from "@/lib/relay/request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const key = await authenticateRelayKey(request);
    const body = await readJsonWithLimit(request);
    const internal = parseAnthropicRequest(body);

    if (internal.stream) {
      return await createRelayStreamResponse(internal, key, "anthropic");
    }

    const result = await invokeWithFallback(internal, key);
    return Response.json(formatAnthropicResponse(result.response, internal.requestedModel));
  } catch (error) {
    return jsonError(error);
  }
}
