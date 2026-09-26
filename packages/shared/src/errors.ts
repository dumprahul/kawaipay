/** Every error code any kawaipay service can return, with its HTTP status (spec sections 1, 5, 12). */
export const ERROR_CODES = {
  INVALID_REQUEST: 400,
  RATE_LIMITED: 429,
  SESSION_EXPIRED: 410,
  BAD_MAC: 401,
  BAD_SEQ: 409,
  BAD_TOKEN: 401,
  IMPLAUSIBLE_PAYLOAD: 422,
  LINK_NOT_FOUND: 404,
  CAMPAIGN_NOT_FOUND: 404,
  CURSOR_INVALID: 400,
  INTERNAL: 500,
  FACILITATOR_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = ERROR_CODES[code];
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** LINK_INACTIVE is a 200 with { ok: false } per spec section 5, not a thrown ApiError. */
export const LINK_INACTIVE = "LINK_INACTIVE" as const;
