import { authenticateRelayKey } from "@/lib/auth/relay-key";
import { jsonError } from "@/lib/internal/errors";
import { parseOpenAIRequest } from "@/lib/protocols/openai/parse-request";
import { formatOpenAIResponse } from "@/lib/protocols/openai/format-response";
import { createRelayStreamResponse, invokeWithFallback } from "@/lib/relay/execute";
import { readJsonWithLimit } from "@/lib/relay/request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const key = await authenticateRelayKey(request);
    const body = await readJsonWithLimit(request);
    const internal = parseOpenAIRequest(body);

    if (internal.stream) {
      return await createRelayStreamResponse(internal, key, "openai");
    }

    const result = await invokeWithFallback(internal, key);
    return Response.json(formatOpenAIResponse(result.response, internal.requestedModel));
  } catch (error) {
    return jsonError(error);
  }
}
