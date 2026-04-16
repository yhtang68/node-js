import { getGmailClient } from './auth';
import { JobEmail, JobPosting } from './types';
import { decodeGmailBodyData } from './utils/gmail';

export async function fetchJobEmails_LinkedIn(): Promise<JobEmail[]> {
  const gmail = await getGmailClient();

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:jobalerts-noreply@linkedin.com',
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
    const body = extractPlainText(detail.data.payload);
    const jobs = parseJobsFromBody(body);

    emails.push({ subject, date, jobs });
  }

  return emails;
}

function extractPlainText(
  payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: any[] | null } | undefined
): string {
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeGmailBodyData(payload.body.data);
  }

  for (const part of payload.parts || []) {
    const text = extractPlainText(part);
    if (text) return text;
  }

  return '';
}

function parseJobsFromBody(body: string): JobPosting[] {
  if (!body) return [];

  return body
    .split(/-{20,}/)
    .map(section => parseJobSection(section))
    .filter((job): job is JobPosting => job !== null);
}

function parseJobSection(section: string): JobPosting | null {
  const lines = section
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const linkLine = lines.find(line => line.startsWith('View job: '));
  if (!linkLine) return null;

  const link = linkLine.replace('View job: ', '').trim();
  const contentLines = stripLeadingNoise(lines.filter(line => line !== linkLine));

  if (contentLines.length < 3) return null;

  const [title, company, location, ...details] = contentLines;

  return {
    title,
    company,
    location,
    details,
    link
  };
}

function stripLeadingNoise(lines: string[]): string[] {
  const noisePatterns = [
    /^your job alert /i,
    /^\d+\+? new jobs match /i,
    /^new jobs match /i,
    /^results from the new ai-powered job search$/i
  ];

  let startIndex = 0;
  while (startIndex < lines.length && noisePatterns.some(pattern => pattern.test(lines[startIndex]))) {
    startIndex += 1;
  }

  return lines.slice(startIndex);
}
