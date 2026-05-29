import type { InternalError } from "@/lib/internal/types";

export class RelayError extends Error {
  type: InternalError["type"];
  status: number;
  retryable: boolean;
  provider?: string;
  providerStatus?: number;
  providerRequestId?: string;

  constructor(options: {
    type: InternalError["type"];
    message: string;
    status?: number;
    retryable?: boolean;
    provider?: string;
    providerStatus?: number;
    providerRequestId?: string;
  }) {
    super(options.message);
    this.name = "RelayError";
    this.type = options.type;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    this.provider = options.provider;
    this.providerStatus = options.providerStatus;
    this.providerRequestId = options.providerRequestId;
  }
}

export function toInternalError(error: unknown): InternalError {
  if (error instanceof RelayError) {
    return {
      type: error.type,
      message: error.message,
      provider: error.provider,
      providerStatus: error.providerStatus,
      providerRequestId: error.providerRequestId,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      type: "internal_error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    type: "internal_error",
    message: "Unknown internal error",
    retryable: false,
  };
}

export function statusToErrorType(status: number): {
  type: InternalError["type"];
  retryable: boolean;
  httpStatus: number;
} {
  if (status === 401) return { type: "authentication_error", retryable: false, httpStatus: 401 };
  if (status === 403) return { type: "permission_error", retryable: false, httpStatus: 403 };
  if (status === 404) return { type: "model_not_found", retryable: false, httpStatus: 404 };
  if (status === 408) return { type: "provider_timeout", retryable: true, httpStatus: 504 };
  if (status === 429) return { type: "rate_limit_error", retryable: true, httpStatus: 429 };
  if (status === 503) return { type: "provider_overloaded", retryable: true, httpStatus: 503 };
  if (status === 504) return { type: "provider_timeout", retryable: true, httpStatus: 504 };
  if (status === 529) return { type: "provider_overloaded", retryable: true, httpStatus: 503 };
  if (status >= 500) return { type: "provider_error", retryable: true, httpStatus: 502 };
  return { type: "invalid_request_error", retryable: false, httpStatus: status || 400 };
}

export function jsonError(error: unknown): Response {
  const internal = toInternalError(error);
  const status = error instanceof RelayError ? error.status : 500;
  return Response.json(
    {
      error: {
        message: internal.message,
        type: internal.type,
        code: internal.type,
      },
    },
    { status },
  );
}
