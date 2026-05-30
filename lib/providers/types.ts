import type {
  InternalChatRequest,
  InternalChatResponse,
  InternalError,
  InternalStreamEvent,
} from "@/lib/internal/types";

export type ProviderProtocol = "openai_chat" | "anthropic_messages";
export type ProviderAuthType = "bearer" | "x-api-key" | "api-key" | "custom";

export type ProviderSourceRecord = {
  id: string;
  name: string;
  providerType: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  authType: ProviderAuthType;
  apiKeyEncrypted: string;
  extraHeadersEncrypted?: string | null;
  timeoutMs: number;
};

export type ModelMappingRecord = {
  id: string;
  publicModelName: string;
  upstreamModelName: string;
  sourceId: string;
  supportsStreaming: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsJsonMode?: boolean;
  inputPricePer1M?: string | null;
  outputPricePer1M?: string | null;
  currency?: string | null;
};

export type ProviderInvokeContext = {
  source: ProviderSourceRecord;
  model: ModelMappingRecord;
  apiKey: string;
  extraHeaders?: Record<string, string>;
  timeoutMs: number;
};

export interface ProviderAdapter {
  id: string;
  protocol: ProviderProtocol;
  invokeChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<InternalChatResponse>;
  streamChat(
    request: InternalChatRequest,
    context: ProviderInvokeContext,
  ): Promise<AsyncIterable<InternalStreamEvent>>;
  testConnection(context: ProviderInvokeContext): Promise<{
    ok: boolean;
    message: string;
  }>;
  normalizeError(error: unknown): InternalError;
}
