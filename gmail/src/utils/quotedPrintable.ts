export function decodeQuotedPrintable(value: string): string {
  if (!value) return '';

  const withoutSoftBreaks = value.replace(/=\r?\n/g, '');

  const bytes: number[] = [];

  for (let i = 0; i < withoutSoftBreaks.length; i += 1) {
    const char = withoutSoftBreaks[i];
    if (char === '=' && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 2;
        continue;
      }
    }

    bytes.push(withoutSoftBreaks.charCodeAt(i) & 0xff);
  }

  return Buffer.from(bytes).toString('utf8');
}
