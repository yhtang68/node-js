import { SalaryRangeUsdYear } from '../types';

function parseMoneyAmountToUsd(value: string): number | undefined {
  const cleaned = value.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return undefined;

  const suffixMatch = cleaned.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!suffixMatch) return undefined;

  const amount = Number.parseFloat(suffixMatch[1]);
  if (!Number.isFinite(amount)) return undefined;

  const suffix = suffixMatch[2]?.toLowerCase();
  if (suffix === 'k') return Math.round(amount * 1_000);
  if (suffix === 'm') return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

function looksNonAnnual(text: string): boolean {
  return /(\/\s*(hr|hour|wk|week|mo|month|day)|\bper\s+(hour|week|month|day)\b)/i.test(text);
}

export function parseSalaryUsdYear(text: string): SalaryRangeUsdYear | undefined {
  if (!text) return undefined;
  if (looksNonAnnual(text)) return undefined;

  const moneyMatches = [...text.matchAll(/\$\s*\d[\d,]*(?:\.\d+)?\s*[kKmM]?/g)].map(match => match[0]);
  if (moneyMatches.length === 0) return undefined;

  const amounts = moneyMatches
    .slice(0, 2)
    .map(match => parseMoneyAmountToUsd(match))
    .filter((value): value is number => typeof value === 'number');

  if (amounts.length === 0) return undefined;

  const minUsd = amounts.length === 1 ? amounts[0] : Math.min(...amounts);
  const maxUsd = amounts.length === 1 ? amounts[0] : Math.max(...amounts);

  return {
    text,
    minUsd,
    maxUsd
  };
}

export function jobMeetsMinSalaryUsdYear(
  salary: SalaryRangeUsdYear | undefined,
  minSalaryUsdYear: number,
  requireSalary: boolean
): boolean {
  if (!salary) return !requireSalary;

  const candidate = salary.maxUsd ?? salary.minUsd;
  if (typeof candidate !== 'number') return !requireSalary;

  return candidate >= minSalaryUsdYear;
}
