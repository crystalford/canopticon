// Standard error envelope per api-v1.0.md.
//
// Every error response is { error: { code, message, details?, trace_id } }.
// Routes throw `ApiError`; the global handler in src/index.ts converts to JSON.

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    trace_id?: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(traceId?: string): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        ...(traceId ? { trace_id: traceId } : {}),
      },
    };
  }
}

export const unauthorized = (msg = "Authentication required"): ApiError =>
  new ApiError(401, "unauthorized", msg);

export const forbidden = (msg = "Forbidden"): ApiError => new ApiError(403, "forbidden", msg);

export const notFound = (msg = "Not found"): ApiError => new ApiError(404, "not_found", msg);

export const badRequest = (msg: string, details?: Record<string, unknown>): ApiError =>
  new ApiError(400, "bad_request", msg, details);

export const internal = (msg = "Internal server error"): ApiError =>
  new ApiError(500, "internal_error", msg);
