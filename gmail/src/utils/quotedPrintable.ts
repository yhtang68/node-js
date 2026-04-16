export function decodeQuotedPrintable(value: string): string {
  if (!value) return '';

  const withoutSoftBreaks = value.replace(/=\r?\n/g, '');
  return withoutSoftBreaks.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

