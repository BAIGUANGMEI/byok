export type InputProtocol = "openai" | "anthropic";
export type OutputProtocol = "openai" | "anthropic";

export type InternalRole = "system" | "user" | "assistant" | "tool";

export type InternalContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: string }
  | { type: "tool_result"; toolCallId: string; content: unknown };

export type InternalMessage = {
  role: InternalRole;
  content: InternalContentBlock[];
  name?: string;
  toolCallId?: string;
};

export type InternalChatRequest = {
  requestId: string;
  inputProtocol: InputProtocol;
  outputProtocol: OutputProtocol;
  requestedModel: string;
  system?: string;
  messages: InternalMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string[];
  stream: boolean;
  tools?: unknown[];
  toolChoice?: unknown;
  responseFormat?: unknown;
  rawRequest?: unknown;
};

export type InternalUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type InternalFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "error";

export type InternalChatResponse = {
  id: string;
  model: string;
  resolvedModel: string;
  sourceId: string;
  upstreamModel: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_call"; id: string; name: string; arguments: unknown }
  >;
  finishReason: InternalFinishReason;
  usage?: InternalUsage;
  providerRequestId?: string;
};

export type InternalError = {
  type:
    | "authentication_error"
    | "permission_error"
    | "rate_limit_error"
    | "quota_exceeded"
    | "invalid_request_error"
    | "model_not_found"
    | "context_length_exceeded"
    | "provider_timeout"
    | "provider_overloaded"
    | "provider_error"
    | "internal_error";
  message: string;
  provider?: string;
  providerStatus?: number;
  providerRequestId?: string;
  retryable: boolean;
};

export type InternalStreamEvent =
  | { type: "message_start"; id: string; model: string }
  | { type: "text_delta"; index: number; text: string }
  | { type: "tool_call_start"; index: number; id: string; name: string }
  | { type: "tool_call_delta"; index: number; argumentsDelta: string }
  | { type: "usage"; usage: InternalUsage }
  | { type: "message_stop"; finishReason: InternalFinishReason }
  | { type: "error"; error: InternalError };
