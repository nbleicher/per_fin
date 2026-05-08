type LogMeta = Record<string, unknown>;

function formatMeta(meta?: LogMeta) {
  return meta ? ` ${JSON.stringify(meta)}` : "";
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.info(`[info] ${message}${formatMeta(meta)}`);
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(`[warn] ${message}${formatMeta(meta)}`);
  },
  error(message: string, meta?: LogMeta) {
    console.error(`[error] ${message}${formatMeta(meta)}`);
  },
};
