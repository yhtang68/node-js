import { getGmailClient } from './auth';
import { JobEmail, JobPosting } from './types';
import { decodeHtmlEntities, stripHtml } from './utils/html';
import { decodeGmailBodyData } from './utils/gmail';
import { decodeQuotedPrintable } from './utils/quotedPrintable';
import { parseSalaryUsdYear } from './utils/salary';

export async function fetchJobEmails_Glassdoor(): Promise<JobEmail[]> {
  const gmail = await getGmailClient();

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:noreply@glassdoor.com',
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
    const body = extractEmailBody(detail.data.payload);
    const jobs = parseJobsFromBody(body);

    emails.push({ subject, date, jobs });
  }

  return emails;
}

function extractEmailBody(
  payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: any[] | null } | undefined
): string {
  if (!payload) return '';

  const mimeType = payload.mimeType ?? '';

  if ((mimeType === 'text/html' || mimeType === 'text/plain') && payload.body?.data) {
    const decoded = decodeGmailBodyData(payload.body.data);
    return decodeMaybeQuotedPrintable(decoded);
  }

  const parts = payload.parts || [];
  for (const part of parts) {
    if (part?.mimeType === 'text/html') {
      const html = extractEmailBody(part);
      if (html) return html;
    }
  }

  for (const part of parts) {
    const text = extractEmailBody(part);
    if (text) return text;
  }

  return '';
}

function parseJobsFromBody(body: string): JobPosting[] {
  if (!body) return [];

  const normalized = body.replace(/\r\n/g, '\n');

  if (looksLikeHtml(normalized)) {
    const jobs = parseJobsFromHtml(normalized);
    if (jobs.length > 0) return jobs;
  }

  const sections = normalized.split(/\n\s*\n-{0,}\s*\n|\n-{8,}\n|\n_{8,}\n/);

  const jobs = sections
    .map(section => parseJobSection(section))
    .filter((job): job is JobPosting => job !== null);

  if (jobs.length > 0) return jobs;

  return parseJobsByUrlAnchors(normalized);
}

function decodeMaybeQuotedPrintable(value: string): string {
  if (!value) return '';
  if (value.includes('=3D') || /=\r?\n/.test(value)) {
    return decodeQuotedPrintable(value);
  }
  return value;
}

function looksLikeHtml(value: string): boolean {
  return /<html[\s>]|<!DOCTYPE html|<table[\s>]/i.test(value);
}

function parseJobsFromHtml(html: string): JobPosting[] {
  const jobs: JobPosting[] = [];

  const anchorRegex =
    /<a\b[^>]*\bhref\s*=\s*"([^"]*glassdoor\.com\/partner\/jobListing\.htm[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = decodeHtmlEntities(match[1]).replace(/&amp;/g, '&').trim();
    const inner = match[2] ?? '';

    const company = extractByClass(inner, 'gd-628b46d9ce');
    const title = extractByClass(inner, 'gd-6c2846d4dc');
    const detailsTexts = extractAllByClass(inner, 'gd-28d35bae2f');

    const location = detailsTexts.find(text => text && !text.includes('$') && !/\best\./i.test(text)) ?? '';
    const salaryText = detailsTexts.find(text => text && text.includes('$')) ?? '';
    const salary = salaryText ? parseSalaryUsdYear(salaryText) : undefined;

    if (!href || !title || !company || !location) continue;

    const ageText = extractAllByClass(inner, 'gd-764e661c5b')
      .map(text => text.trim())
      .filter(Boolean)[0];

    const ratingRaw = extractAllByClass(inner, 'gd-562cbc7b4e')
      .map(text => text.trim())
      .filter(Boolean)[0];

    const rating = ratingRaw ? normalizeRating(ratingRaw) : '';

    const details = [ageText, rating].filter(Boolean).slice(0, 8);

    jobs.push({
      title,
      company,
      location,
      details,
      link: href,
      salary
    });
  }

  return jobs;
}

function normalizeRating(value: string): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  const match = clean.match(/(\d+(?:\.\d+)?)\s*★/);
  if (match) return `Rated: ${match[1]} ★`;
  if (clean) return `Rated: ${clean}`;
  return '';
}

function extractByClass(html: string, className: string): string {
  const regex = new RegExp(`<[^>]+class\\s*=\\s*"[^"]*\\b${escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
  const match = html.match(regex);
  if (!match) return '';
  return decodeHtmlEntities(stripHtml(match[1]));
}

function extractAllByClass(html: string, className: string): string[] {
  const regex = new RegExp(
    `<[^>]+class\\s*=\\s*"[^"]*\\b${escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    'gi'
  );

  const results: string[] = [];
  for (const match of html.matchAll(regex)) {
    const text = decodeHtmlEntities(stripHtml(match[1] ?? ''));
    if (text) results.push(text);
  }
  return results;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseJobsByUrlAnchors(body: string): JobPosting[] {
  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const urlLineIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /https?:\/\/\S+/i.test(line) && /glassdoor\.com/i.test(line))
    .map(item => item.index);

  const jobs: JobPosting[] = [];

  for (const urlIndex of urlLineIndexes) {
    const chunkStart = Math.max(0, urlIndex - 8);
    const chunkEnd = Math.min(lines.length, urlIndex + 4);
    const chunk = lines.slice(chunkStart, chunkEnd).join('\n');
    const parsed = parseJobSection(chunk);
    if (parsed) jobs.push(parsed);
  }

  return jobs;
}

function parseJobSection(section: string): JobPosting | null {
  const lines = section
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const link = extractGlassdoorLink(lines.join('\n'));
  if (!link) return null;

  const withoutLink = stripNoise(lines.filter(line => !line.includes(link)));
  if (withoutLink.length === 0) return null;

  const salaryLine = withoutLink.find(line => /\$\s*\d/.test(line));
  const salary = salaryLine ? parseSalaryUsdYear(salaryLine) : undefined;

  const contentLines = withoutLink.filter(line => line !== salaryLine);
  const [title, company, location] = guessTitleCompanyLocation(contentLines);
  if (!title || !company || !location) return null;

  const details = contentLines
    .slice(0, 14)
    .filter(line => line !== title && line !== company && line !== location);

  return {
    title,
    company,
    location,
    details,
    link,
    salary
  };
}

function extractGlassdoorLink(text: string): string | null {
  const urlMatches = [...text.matchAll(/https?:\/\/\S+/gi)].map(match => match[0]);
  const glassdoor = urlMatches.find(url => /glassdoor\.com/i.test(url));
  if (!glassdoor) return null;
  return glassdoor.replace(/[)>.,]+$/g, '');
}

function stripNoise(lines: string[]): string[] {
  const noisePatterns = [
    /^recommended jobs/i,
    /^job alert/i,
    /^jobs you may like/i,
    /^unsubscribe/i,
    /^manage your/i,
    /^privacy policy/i
  ];

  return lines.filter(line => !noisePatterns.some(pattern => pattern.test(line)));
}

function guessTitleCompanyLocation(lines: string[]): [string, string, string] {
  if (lines.length < 2) return ['', '', ''];

  const first = lines[0];
  const atMatch = first.match(/^(.*)\s+at\s+(.*)$/i);
  if (atMatch) {
    const location = lines.find(line => looksLikeLocation(line)) ?? lines[1] ?? '';
    return [atMatch[1].trim(), atMatch[2].trim(), location.trim()];
  }

  const title = first;
  const company = lines[1] ?? '';
  const location = lines.find(line => looksLikeLocation(line)) ?? (lines[2] ?? '');
  return [title.trim(), company.trim(), location.trim()];
}

function looksLikeLocation(value: string): boolean {
  if (!value) return false;
  if (/\bremote\b/i.test(value)) return true;
  if (/[A-Za-z].*,\s*[A-Za-z]{2}\b/.test(value)) return true;
  if (/[A-Za-z].*,\s*[A-Za-z]{3,}\b/.test(value)) return true;
  return false;
}
