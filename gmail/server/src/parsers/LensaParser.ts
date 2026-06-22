import { JobRecord, ParseJobsFromMessageInput } from './BaseJobEmailParser';
import { HtmlJobEmailParser } from './HtmlJobEmailParser';
import { JobEmail, RawJobPosting } from '../types';
import { parseSalaryUsdYear } from '../utils/salary';

const LENSA = {
  REGEX: {
    CARD_LINK: /https?:\/\/email\.mg\d+\.lensa\.com\/c\//i,
    CARD_START: /<tr><td><a\b[^>]*href\s*=\s*"([^"]*https?:\/\/email\.mg\d+\.lensa\.com\/c\/[^"]*)"[^>]*>/gi,
    CARD_COMPANY: /<td\b[^>]*colspan\s*=\s*"?2"?[^>]*font-weight\s*:\s*700[^>]*font-size\s*:\s*16px[^>]*>([\s\S]*?)<\/td>/i,
    CARD_TITLE: /<td\b[^>]*color\s*:\s*#0682E0[^>]*font-weight\s*:\s*700[^>]*font-size\s*:\s*16px[^>]*>([\s\S]*?)<\/td>/i,
    BLOCKED_TITLE: /^(edit settings|more jobs|unsubscribe|privacy policy|faq)$/i,
    SKIPPED_SHORT_TITLE: /^(LE|Location:?|•)$/i,
    TD_TEXT: /<td\b[^>]*>([\s\S]*?)<\/td>/gi,
    SALARY_IN_CARD: /<div\b[^>]*color\s*:\s*#(?:4D5358|343A3F)[^>]*>([\s\S]*?)<\/div>/gi,
    SPAN_TEXT: /<span\b[^>]*>([\s\S]*?)<\/span>/gi,
    NUMERIC_ONLY: /^\d+(\.\d+)?$/,
    STARS_ONLY: /^[★\s]+$/,
    MORE_JOBS_BOUNDARY: /(?:\[\s*)?more jobs\s*(?:➞|»)?/i
  },
  LIMIT: {
    MAX_DETAILS_COUNT: 8,
    MAX_DETAIL_LENGTH: 70
  }
} as const;

export async function fetchJobEmails_Lensa(): Promise<JobEmail[]> {
  return new LensaEmailParser().fetchJobEmails();
}

export class LensaEmailParser extends HtmlJobEmailParser {
  protected readonly searchQuery = 'from:jobalert@lensa.com';

  protected async parseJobsFromMessage(input: ParseJobsFromMessageInput): Promise<RawJobPosting[]> {
    const baseInput = {
      payload: input.payload,
      gmail: input.gmail,
      messageId: input.messageId,
      allowAttachment: true
    };

    const htmlBody = await this.extractBodyByMime({
      ...baseInput,
      wantedMimeType: 'text/html'
    });
    const jobsFromHtml = this.parseJobsFromBody(htmlBody);
    if (jobsFromHtml.length > 0) return jobsFromHtml;

    const textBody = await this.extractBodyByMime({
      ...baseInput,
      wantedMimeType: 'text/plain'
    });
    return this.parseJobsFromBody(textBody);
  }

  protected parseJobsFromHtml(html: string): RawJobPosting[] {
    const normalized = this.truncateAtMoreJobs(this.decodeHtmlText(html)).replace(/\r\n/g, '\n');
    return this.parseJobsFromCards(normalized);
  }

  protected getJobKey(job: RawJobPosting): string {
    const upnMatch = job.link.match(/[?&]upn=([^&]+)/i);
    if (upnMatch) return `lensa:${upnMatch[1].toLowerCase()}`;
    return `lensa:${job.title}|${job.company}|${job.location}`.toLowerCase();
  }

  private extractSalaryFromCard(card: string): string {
    for (const match of card.matchAll(LENSA.REGEX.SALARY_IN_CARD)) {
      const text = this.cleanHtmlText(match[1] ?? '');
      if (this.looksLikeSalary(text)) return text;
    }
    return '';
  }

  private extractDetailsFromCard(card: string): string[] {
    const details: string[] = [];

    for (const match of card.matchAll(LENSA.REGEX.SPAN_TEXT)) {
      const text = this.cleanHtmlText(match[1] ?? '');
      if (!text) continue;
      if (text.length > LENSA.LIMIT.MAX_DETAIL_LENGTH) continue;
      if (LENSA.REGEX.STARS_ONLY.test(text)) continue;
      if (LENSA.REGEX.NUMERIC_ONLY.test(text)) continue;
      if (LENSA.REGEX.SKIPPED_SHORT_TITLE.test(text)) continue;
      if (text.toLowerCase() === 'new') continue;
      details.push(text);
    }

    return Array.from(new Set(details)).slice(0, LENSA.LIMIT.MAX_DETAILS_COUNT);
  }

  private parseJobsFromCards(html: string): RawJobPosting[] {
    this.resetJobRecords();
    const seenKeys = new Set<string>();
    const starts = Array.from(html.matchAll(LENSA.REGEX.CARD_START));

    for (let index = 0; index < starts.length; index += 1) {
      const match = starts[index];
      const link = (match[1] ?? '').replace(/&amp;/g, '&').trim();
      const start = match.index ?? 0;
      const end = starts[index + 1]?.index ?? html.length;
      const card = html.slice(start, end);
      if (!LENSA.REGEX.CARD_LINK.test(link)) continue;

      const company = this.normalizeCompany(this.cleanHtmlText(card.match(LENSA.REGEX.CARD_COMPANY)?.[1] ?? ''));
      const title = this.cleanHtmlText(card.match(LENSA.REGEX.CARD_TITLE)?.[1] ?? '');
      if (!company || !title) continue;
      if (LENSA.REGEX.BLOCKED_TITLE.test(title)) continue;
      if (LENSA.REGEX.SKIPPED_SHORT_TITLE.test(title)) continue;

      const salaryText = this.extractSalaryFromCard(card);
      const salary = salaryText ? parseSalaryUsdYear(salaryText) : undefined;
      const details = this.extractDetailsFromCard(card);
      const location = this.extractLocationFromCard(card, details, title, company);
      if (!location) continue;

      const dedupeKey = `${title}|${company}|${location}|${link}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const jobRecord = new JobRecord();
      jobRecord.title = title;
      jobRecord.company = company;
      jobRecord.location = location;
      jobRecord.link = link;
      jobRecord.salary = salary;
      jobRecord.addDetails(details);
      this.addJobRecord(jobRecord);
    }

    return this.toRawJobPostingsFromJobRecords();
  }

  private extractLocationFromCard(card: string, details: string[], title: string, company: string): string {
    const normalizedTitle = title.toLowerCase();
    const normalizedCompany = company.replace(/\u2024/g, '·').toLowerCase();

    for (const match of card.matchAll(LENSA.REGEX.TD_TEXT)) {
      const text = this.cleanHtmlText(match[1] ?? '');
      if (!text) continue;
      const normalizedText = text.replace(/\u2024/g, '·').toLowerCase();
      if (normalizedText.includes(normalizedTitle)) continue;
      if (normalizedText.includes(normalizedCompany)) continue;
      if (this.looksLikeSalary(text)) continue;
      if (/\bfull-time\b|\bpart-time\b|\bcontract\b/i.test(text)) continue;

      for (const part of text.split('•').map(value => value.trim()).filter(Boolean)) {
        if (/^posted\b/i.test(part)) continue;
        if (/^remote$/i.test(part)) continue;
        if (this.looksLikeSalary(part)) continue;
        if (this.looksLikeLocation(part)) return part;
      }
    }

    return details.find(detail => this.looksLikeLocation(detail)) ?? '';
  }

  private truncateAtMoreJobs(value: string): string {
    const match = value.match(LENSA.REGEX.MORE_JOBS_BOUNDARY);
    if (match?.index === undefined) return value;
    return value.slice(0, match.index);
  }

  private normalizeCompany(value: string): string {
    const trimmed = value.replace(/[=]+\s*$/g, '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\u2024/g, '·').trim();
  }
}
