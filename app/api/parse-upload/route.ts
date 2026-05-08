import { apiError, apiOk } from "@/lib/api/contracts";
import { prisma } from "@/lib/db/prisma";
import { parseDocument } from "@/lib/chatbot/parsers";
import { buildExtractionPayload } from "@/lib/chatbot/extraction-normalizer";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".pdf", ".txt"];

function hasAllowedExtension(filename: string) {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return apiError(
      "VALIDATION_ERROR",
      "Content-Type must be multipart/form-data with a `file` field.",
      422,
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return apiError("VALIDATION_ERROR", "Invalid multipart payload.", 422);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "Upload a file in form field `file`.", 422);
  }
  if (!hasAllowedExtension(file.name)) {
    return apiError("UNSUPPORTED_FILE", "Supported types: csv, xlsx, xls, pdf, txt.", 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError("FILE_TOO_LARGE", "File exceeds 8MB size limit.", 413);
  }

  const accounts = await prisma.account.findMany();
  const { rows, warnings } = await parseDocument(file, accounts);
  const payload = buildExtractionPayload(file.name, rows, warnings);

  return apiOk(payload);
}

