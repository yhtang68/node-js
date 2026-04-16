import { getGmailClient } from './auth';
import { JobEmail, JobPosting } from './types';
import { decodeGmailBodyData } from './utils/gmail';
import { decodeHtmlEntities, stripHtml } from './utils/html';
import { decodeQuotedPrintable } from './utils/quotedPrintable';
import { parseSalaryUsdYear } from './utils/salary';

export async function fetchJobEmails_Lensa(): Promise<JobEmail[]> {
  const gmail = await getGmailClient();

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:jobalert@lensa.com',
    maxResults: 100
  });

  if (!res.data.messages) return [];

  const emails: JobEmail[] = [];

  for (const msg of res.data.messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full'
    });

    const headers = detail.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    const body = await extractPreferredBody(gmail, msg.id!, detail.data.payload);
    const jobs = parseJobsFromBody(body);

    emails.push({ subject, date, jobs });
  }

  return emails;
}

async function extractPreferredBody(
  gmail: any,
  messageId: string,
  payload:
    | {
        mimeType?: string | null;
        body?: { data?: string | null; attachmentId?: string | null } | null;
        parts?: any[] | null;
      }
    | undefined
): Promise<string> {
  const htmlBody = await extractBodyByMime(gmail, messageId, payload, 'text/html');
  if (htmlBody) return htmlBody;

  const textBody = await extractBodyByMime(gmail, messageId, payload, 'text/plain');
  if (textBody) return textBody;

  return '';
}

async function extractBodyByMime(
  gmail: any,
  messageId: string,
  payload:
    | {
        mimeType?: string | null;
        body?: { data?: string | null; attachmentId?: string | null } | null;
        parts?: any[] | null;
      }
    | undefined,
  wantedMimeType: 'text/html' | 'text/plain'
): Promise<string> {
  if (!payload) return '';

  const mimeType = payload.mimeType ?? '';
  if (mimeType === wantedMimeType) {
    if (payload.body?.data) {
      const decoded = decodeGmailBodyData(payload.body.data);
      return decodeMaybeQuotedPrintable(decoded);
    }

    if (payload.body?.attachmentId) {
      const attachment = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: payload.body.attachmentId
      });

      const attachmentData = attachment?.data?.data;
      if (attachmentData) {
        const decoded = decodeGmailBodyData(attachmentData);
        return decodeMaybeQuotedPrintable(decoded);
      }
    }
  }

  const parts = payload.parts || [];
  for (const part of parts) {
    const result = await extractBodyByMime(gmail, messageId, part, wantedMimeType);
    if (result) return result;
  }

  return '';
}

function decodeMaybeQuotedPrintable(value: string): string {
  if (!value) return '';
  if (value.includes('=3D') || /=\r?\n/.test(value)) {
    return decodeQuotedPrintable(value);
  }
  return value;
}

function parseJobsFromBody(body: string): JobPosting[] {
  if (!body) return [];

  const normalized = body.replace(/\r\n/g, '\n');
  if (looksLikeHtml(normalized)) {
    const fromHtml = parseJobsFromHtml(normalized);
    if (fromHtml.length > 0) return fromHtml;
  }

  return parseJobsFromText(normalized);
}

function looksLikeHtml(value: string): boolean {
  return /<html[\s>]|<!DOCTYPE html|<table[\s>]/i.test(value);
}

function parseJobsFromHtml(html: string): JobPosting[] {
  const normalized = decodeHtmlEntities(decodeMaybeQuotedPrintable(html)).replace(/\r\n/g, '\n');
  const cardStart = '<table style="border:1px solid #DDE1E6;border-radius:8px;display:inline-block;border-collapse:collapse">';
  const cardSections = normalized.split(cardStart).slice(1);

  const jobs: JobPosting[] = [];
  const seenKeys = new Set<string>();

  for (const section of cardSections) {
    const company = extractCompanyFromCard(section);
    const titleAndLink = extractTitleAndLinkFromCard(section);
    const location = extractLocationFromCard(section);
    const salaryText = extractSalaryFromCard(section);
    const details = extractDetailsFromCard(section);

    if (!company || !titleAndLink || !location) continue;

    const salary = salaryText ? parseSalaryUsdYear(salaryText) : undefined;
    const key = `${titleAndLink.title}|${company}|${location}|${titleAndLink.link}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    jobs.push({
      title: titleAndLink.title,
      company,
      location,
      details,
      link: titleAndLink.link,
      salary
    });
  }

  return jobs;
}

function extractCompanyFromCard(card: string): string {
  const companyRegex =
    /<td\b[^>]*font-weight\s*:\s*600[^>]*font-size\s*:\s*14px[^>]*>([\s\S]*?)<\/td>/gi;
  let company = '';

  for (const match of card.matchAll(companyRegex)) {
    const text = cleanText(match[1] ?? '');
    if (!text) continue;
    if (/^\d+(\.\d+)?$/.test(text)) continue;
    if (/^[★\s]+$/.test(text)) continue;
    if (text.length > 90) continue;
    company = text.replace(/\u2024/g, '·');
    break;
  }

  return company;
}

function extractTitleAndLinkFromCard(card: string): { title: string; link: string } | null {
  const anchorRegex = /<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of card.matchAll(anchorRegex)) {
    const rawLink = (match[1] ?? '').replace(/&amp;/g, '&').trim();
    const title = cleanText(match[2] ?? '');
    if (!rawLink || !title) continue;
    if (!/https?:\/\/sg3email\.lensa\.com\/ls\/click\?/i.test(rawLink)) continue;
    if (title.length > 140) continue;
    if (/^(edit settings|more jobs|unsubscribe|privacy policy|faq)$/i.test(title)) continue;
    if (/^(LE|Location:?)$/i.test(title)) continue;
    return { title, link: rawLink };
  }

  return null;
}

function extractLocationFromCard(card: string): string {
  const locationNearIconRegex = /icon_location\.png[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i;
  const nearIcon = card.match(locationNearIconRegex);
  if (nearIcon) {
    const location = cleanText(nearIcon[1] ?? '');
    if (looksLikeLocation(location)) return location;
  }

  const divRegex = /<div\b[^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of card.matchAll(divRegex)) {
    const text = cleanText(match[1] ?? '');
    if (looksLikeLocation(text)) return text;
  }

  return '';
}

function extractSalaryFromCard(card: string): string {
  const salaryRegex = /<div\b[^>]*color\s*:\s*#4D5358[^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of card.matchAll(salaryRegex)) {
    const text = cleanText(match[1] ?? '');
    if (looksLikeSalary(text)) return text;
  }
  return '';
}

function extractDetailsFromCard(card: string): string[] {
  const spanRegex = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;
  const details: string[] = [];

  for (const match of card.matchAll(spanRegex)) {
    const text = cleanText(match[1] ?? '');
    if (!text) continue;
    if (text.length > 70) continue;
    if (/^[★\s]+$/.test(text)) continue;
    if (/^\d+(\.\d+)?$/.test(text)) continue;
    if (text.toLowerCase() === 'new') continue;
    details.push(text);
  }

  const deduped = Array.from(new Set(details));
  return deduped.slice(0, 8);
}

function cleanText(value: string): string {
  return decodeHtmlEntities(
    stripHtml(
      value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
  )
    .replace(/\s+/g, ' ')
    .replace(/[=]+\s*$/g, '')
    .trim();
}

function parseJobsFromText(text: string): JobPosting[] {
  const lines = text
    .split('\n')
    .map(line => decodeHtmlEntities(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const linkRegex = /^\[([^\]]+)\]\((https?:\/\/sg3email\.lensa\.com\/ls\/click\?[^)]+)\)$/i;
  const jobs: JobPosting[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(linkRegex);
    if (!match) continue;

    const title = match[1].trim();
    const link = match[2].trim();
    const company = findCompanyNear(lines, index);
    const location = findLocationNear(lines, index);
    const salaryText = findSalaryNear(lines, index);
    const salary = salaryText ? parseSalaryUsdYear(salaryText) : undefined;
    const details = findDetailsNear(lines, index).filter(Boolean);

    if (!title || !link || !company || !location) continue;

    jobs.push({
      title,
      company,
      location,
      details,
      link,
      salary
    });
  }

  return jobs;
}

function findCompanyNear(lines: string[], anchorIndex: number): string {
  for (let i = anchorIndex - 1; i >= Math.max(0, anchorIndex - 12); i -= 1) {
    const candidate = normalizeCompany(lines[i]);
    if (!candidate) continue;
    if (looksLikeLocation(candidate)) continue;
    if (looksLikeSalary(candidate)) continue;
    if (looksLikeTitleLinkLine(candidate)) continue;
    if (candidate.includes('|') && candidate.includes('★')) continue;
    if (candidate.length < 2 || candidate.length > 80) continue;
    return candidate;
  }
  return '';
}

function normalizeCompany(value: string): string {
  const trimmed = value.replace(/[=]+\s*$/g, '').trim();
  if (!trimmed) return '';
  if (trimmed === '---' || trimmed.startsWith('---|---')) return '';
  if (trimmed.startsWith('![') || trimmed.startsWith('|')) return '';
  if (/^your job alerts/i.test(trimmed)) return '';
  return trimmed.replace(/\u2024/g, '·').trim();
}

function looksLikeTitleLinkLine(value: string): boolean {
  return /^\[.+\]\(https?:\/\/sg3email\.lensa\.com\/ls\/click\?/i.test(value);
}

function findLocationNear(lines: string[], anchorIndex: number): string {
  for (let i = anchorIndex + 1; i <= Math.min(lines.length - 1, anchorIndex + 12); i += 1) {
    const candidate = lines[i];
    if (!candidate) continue;
    if (looksLikeLocation(candidate)) return candidate;
  }
  return '';
}

function looksLikeLocation(value: string): boolean {
  if (!value) return false;
  if (/\bremote\b/i.test(value)) return true;
  if (/[A-Za-z].*,\s*[A-Za-z]{2}\b/.test(value)) return true;
  if (/[A-Za-z].*,\s*[A-Za-z]{3,}\b/.test(value)) return true;
  return false;
}

function findSalaryNear(lines: string[], anchorIndex: number): string {
  for (let i = anchorIndex; i <= Math.min(lines.length - 1, anchorIndex + 14); i += 1) {
    const candidate = lines[i];
    if (!candidate) continue;
    if (looksLikeSalary(candidate)) return candidate;
  }
  return '';
}

function looksLikeSalary(value: string): boolean {
  return /\$\s*\d/.test(value) || /\babout\s*\$\s*\d/i.test(value);
}

function findDetailsNear(lines: string[], anchorIndex: number): string[] {
  const details: string[] = [];

  for (let i = anchorIndex + 1; i <= Math.min(lines.length - 1, anchorIndex + 22); i += 1) {
    const candidate = lines[i];
    if (!candidate) continue;
    if (looksLikeLocation(candidate)) continue;
    if (looksLikeSalary(candidate)) continue;
    if (candidate.startsWith('[') || candidate.startsWith('![')) continue;
    if (candidate.startsWith('---')) continue;
    if (/^your job alerts/i.test(candidate)) continue;

    if (/\bfull-time\b/i.test(candidate) || /\bpart-time\b/i.test(candidate) || /\bcontract\b/i.test(candidate)) {
      details.push(...splitTags(candidate));
      break;
    }
  }

  return details.map(item => item.trim()).filter(Boolean).slice(0, 8);
}

function splitTags(value: string): string[] {
  const normalized = value.replace(/\s{2,}/g, '  ').trim();
  if (normalized.includes('  ')) {
    return normalized.split('  ').map(part => part.trim()).filter(Boolean);
  }
  return [normalized];
}
