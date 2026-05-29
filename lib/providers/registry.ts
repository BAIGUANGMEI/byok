import { AnthropicCompatibleAdapter } from "@/lib/providers/anthropic-compatible";
import { OpenAICompatibleAdapter } from "@/lib/providers/openai-compatible";
import type { ProviderAdapter, ProviderProtocol } from "@/lib/providers/types";
import { RelayError } from "@/lib/internal/errors";

const adapters: Record<ProviderProtocol, ProviderAdapter> = {
  openai_chat: new OpenAICompatibleAdapter(),
  anthropic_messages: new AnthropicCompatibleAdapter(),
};

export function getProviderAdapter(protocol: string): ProviderAdapter {
  const adapter = adapters[protocol as ProviderProtocol];
  if (!adapter) {
    throw new RelayError({
      type: "invalid_request_error",
      message: `Unsupported provider protocol: ${protocol}`,
      status: 400,
    });
  }
  return adapter;
}
