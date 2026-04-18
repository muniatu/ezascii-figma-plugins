export const CHARSETS = {
  simple: ' .-=+*#',
  standard: ' .:-=+*#%@',
  detailed:
    ' .\'`^",:;Il!i><~+_-?][}{1)(|/\\tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
} as const;

export type CharsetKey = keyof typeof CHARSETS;

export function getCharset(key: CharsetKey | string): string {
  return (CHARSETS as Record<string, string>)[key] ?? CHARSETS.standard;
}
