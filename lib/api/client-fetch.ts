import { MAX_PAGE_SIZE } from "@/lib/api/contracts";

type ApiSuccess<T> = { ok: true; data: T; meta?: Record<string, unknown> };
type ApiErrorBody = { ok: false; error: { code: string; message: string } };

export async function parseOk<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiSuccess<T> | ApiErrorBody;
  if (!res.ok || !body.ok) {
    throw new Error(body.ok ? "Request failed." : body.error.message);
  }
  return body.data;
}

export async function fetchPaginatedList<T>(basePath: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  const sep = basePath.includes("?") ? "&" : "?";
  for (;;) {
    const res = await fetch(`${basePath}${sep}page=${page}&pageSize=${MAX_PAGE_SIZE}`);
    const body = (await res.json()) as ApiSuccess<T[]> | ApiErrorBody;
    if (!res.ok || !body.ok) break;
    out.push(...body.data);
    const meta = body.meta as { totalPages?: number } | undefined;
    const totalPages = meta?.totalPages ?? 1;
    if (page >= totalPages || body.data.length === 0) break;
    page += 1;
  }
  return out;
}
