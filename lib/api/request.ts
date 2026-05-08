import type { z } from "zod";
import { apiError } from "@/lib/api/contracts";

export async function parseBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
) {
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return { error: apiError("INVALID_JSON", "Request body must be valid JSON.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: apiError("VALIDATION_ERROR", "Payload failed validation.", 422, parsed.error.flatten()),
    };
  }
  return { data: parsed.data as z.infer<TSchema> };
}

export function parseIntParam(value: string, fieldName = "id") {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      error: apiError("INVALID_ID", `${fieldName} must be a positive integer.`, 400),
    };
  }
  return { data: parsed };
}
