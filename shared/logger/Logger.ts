export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string): void {
  const line = `[InvoiceRouter] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
