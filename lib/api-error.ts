import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  const requestId = crypto.randomUUID();
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong on our side. Please try again.";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "The request data is not valid.";
    details = err.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));
  } else {
    console.error(`[${requestId}] Unhandled error:`, err);
  }

  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(details !== undefined ? { details } : {}), requestId } },
    { status, headers: { "X-Request-Id": requestId } },
  );
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

export function withErrorHandling<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}