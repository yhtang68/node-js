import { JobRecord, ParseJobsFromMessageInput } from './BaseJobEmailParser';
import { HtmlJobEmailParser } from './HtmlJobEmailParser';
import { JobEmail, RawJobPosting } from '../types';
import { parseSalaryUsdYear } from '../utils/salary';

const GLASSDOOR = {
  REGEX: {
    JOB_ANCHOR: /<a\b[^>]*\bhref\s*=\s*"([^"]*glassdoor\.com\/partner\/jobListing\.htm[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    TEXT_SECTION_SPLIT: /\n\s*\n-{0,}\s*\n|\n-{8,}\n|\n_{8,}\n/,
    URL: /https?:\/\/\S+/gi,
    URL_TEST: /https?:\/\/\S+/i,
    DOMAIN: /glassdoor\.com/i,
    ESTIMATED_SALARY_SUFFIX: /\best\./i,
    SALARY_HINT: /\$\s*\d/,
    TITLE_COMPANY_AT: /^(.*)\s+at\s+(.*)$/i
  },
  CLASS: {
    COMPANY: 'gd-628b46d9ce',
    TITLE: 'gd-6c2846d4dc',
    DETAILS: 'gd-28d35bae2f',
    AGE: 'gd-764e661c5b',
    RATING: 'gd-562cbc7b4e'
  },
  NOISE: {
    LINE_PATTERNS: [/^recommended jobs/i, /^job alert/i, /^jobs you may like/i, /^unsubscribe/i, /^manage your/i, /^privacy policy/i]
  },
  WINDOW: {
    URL_CHUNK_BACK: 8,
    URL_CHUNK_FORWARD: 4
  },
  LIMIT: {
    DETAILS_MAX: 8,
    TEXT_SECTION_DETAILS_MAX: 14
  }
} as const;

export async function fetchJobEmails_Glassdoor(): Promise<JobEmail[]> {
  return new GlassdoorEmailParser().fetchJobEmails();
}

export class GlassdoorEmailParser extends HtmlJobEmailParser {
  protected readonly searchQuery = 'from:noreply@glassdoor.com';

  protected async parseJobsFromMessage(input: ParseJobsFromMessageInput): Promise<RawJobPosting[]> {
    const body = await this.extractPreferredBody({
      payload: input.payload,
      gmail: input.gmail,
      messageId: input.messageId
    });
    return this.parseJobsFromBody(body);
  }

  protected parseJobsFromHtml(html: string): RawJobPosting[] {
    this.resetJobRecords();

    for (const match of html.matchAll(GLASSDOOR.REGEX.JOB_ANCHOR)) {
      const href = this.decodeHtmlText(match[1]).replace(/&amp;/g, '&').trim();
      const inner = match[2] ?? '';

      const company = this.extractByClass(inner, GLASSDOOR.CLASS.COMPANY);
      const title = this.extractByClass(inner, GLASSDOOR.CLASS.TITLE);
      const detailsTexts = this.extractAllByClass(inner, GLASSDOOR.CLASS.DETAILS);

      const location = detailsTexts.find(text => text && !text.includes('$') && !GLASSDOOR.REGEX.ESTIMATED_SALARY_SUFFIX.test(text)) ?? '';
      const salaryText = detailsTexts.find(text => text && text.includes('$')) ?? '';
      const salary = salaryText ? parseSalaryUsdYear(salaryText) : undefined;
      if (!href || !title || !company || !location) continue;

      const ageRaw = this.extractAllByClass(inner, GLASSDOOR.CLASS.AGE)
        .map(text => text.trim())
        .filter(Boolean)[0];
      const ageText = ageRaw ? this.normalizePosted(ageRaw) : '';

      const ratingRaw = this.extractAllByClass(inner, GLASSDOOR.CLASS.RATING)
        .map(text => text.trim())
        .filter(Boolean)[0];
      const rating = ratingRaw ? this.normalizeRating(ratingRaw) : '';

      const details = [ageText, rating].filter(Boolean).slice(0, GLASSDOOR.LIMIT.DETAILS_MAX);
      const jobRecord = new JobRecord();
      jobRecord.title = title;
      jobRecord.company = company;
      jobRecord.location = location;
      jobRecord.link = href;
      jobRecord.salary = salary;
      jobRecord.postedDate = ageText;
      jobRecord.rating = rating;
      jobRecord.addDetails(details);
      this.addJobRecord(jobRecord);
    }
    return this.toRawJobPostingsFromJobRecords();
  }

  protected parseJobsFromText(text: string): RawJobPosting[] {
    const sections = text.split(GLASSDOOR.REGEX.TEXT_SECTION_SPLIT);
    const jobs: RawJobPosting[] = [];

    for (const section of sections) {
      const job = this.parseJobSection(section);
      if (job) jobs.push(job);
    }

    if (jobs.length > 0) return jobs;
    return this.parseJobsByUrlAnchors(text);
  }

  protected getJobKey(job: RawJobPosting): string {
    const glassdoorIdMatch = job.link.match(/[?&]jobListingId=(\d+)/i);
    if (glassdoorIdMatch) return `glassdoor:${glassdoorIdMatch[1]}`;

    const glassdoorJlMatch = job.link.match(/\bJL_(\d+)\b/i);
    if (glassdoorJlMatch) return `glassdoor:JL_${glassdoorJlMatch[1]}`;

    return `glassdoor:${job.title}|${job.company}|${job.location}`.toLowerCase();
  }

  private normalizeRating(value: string): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    const match = clean.match(/(\d+(?:\.\d+)?)\s*★/);
    if (match) return `Rated: ${match[1]} ★`;
    if (clean) return `Rated: ${clean}`;
    return '';
  }

  private normalizePosted(value: string): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return `Posted: ${clean}`;
  }

  private extractByClass(html: string, className: string): string {
    const regex = new RegExp(
      `<[^>]+class\\s*=\\s*"[^"]*\\b${this.escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      'i'
    );
    const match = html.match(regex);
    if (!match) return '';
    return this.cleanHtmlText(match[1] ?? '');
  }

  private extractAllByClass(html: string, className: string): string[] {
    const regex = new RegExp(
      `<[^>]+class\\s*=\\s*"[^"]*\\b${this.escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      'gi'
    );

    const results: string[] = [];
    for (const match of html.matchAll(regex)) {
      const text = this.cleanHtmlText(match[1] ?? '');
      if (text) results.push(text);
    }
    return results;
  }

  private parseJobsByUrlAnchors(body: string): RawJobPosting[] {
    const lines = body
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const urlLineIndexes = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => GLASSDOOR.REGEX.URL_TEST.test(line) && GLASSDOOR.REGEX.DOMAIN.test(line))
      .map(item => item.index);

    const jobs: RawJobPosting[] = [];
    for (const urlIndex of urlLineIndexes) {
      const chunkStart = Math.max(0, urlIndex - GLASSDOOR.WINDOW.URL_CHUNK_BACK);
      const chunkEnd = Math.min(lines.length, urlIndex + GLASSDOOR.WINDOW.URL_CHUNK_FORWARD);
      const chunk = lines.slice(chunkStart, chunkEnd).join('\n');
      const parsed = this.parseJobSection(chunk);
      if (parsed) jobs.push(parsed);
    }
    return jobs;
  }

  private parseJobSection(section: string): RawJobPosting | null {
    const lines = section
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const link = this.extractGlassdoorLink(lines.join('\n'));
    if (!link) return null;

    const withoutLink = this.stripNoise(lines.filter(line => !line.includes(link)));
    if (withoutLink.length === 0) return null;

    const salaryLine = withoutLink.find(line => GLASSDOOR.REGEX.SALARY_HINT.test(line));
    const salary = salaryLine ? parseSalaryUsdYear(salaryLine) : undefined;

    const contentLines = withoutLink.filter(line => line !== salaryLine);
    const [title, company, location] = this.guessTitleCompanyLocation(contentLines);
    if (!title || !company || !location) return null;

    const details = contentLines
      .slice(0, GLASSDOOR.LIMIT.TEXT_SECTION_DETAILS_MAX)
      .filter(line => line !== title && line !== company && line !== location);

    const jobRecord = new JobRecord();
    jobRecord.title = title;
    jobRecord.company = company;
    jobRecord.location = location;
    jobRecord.link = link;
    jobRecord.salary = salary;
    jobRecord.addDetails(details);
    return jobRecord.toRawJobPosting();
  }

  private extractGlassdoorLink(text: string): string | null {
    const urlMatches = [...text.matchAll(GLASSDOOR.REGEX.URL)].map(match => match[0]);
    const glassdoor = urlMatches.find(url => GLASSDOOR.REGEX.DOMAIN.test(url));
    if (!glassdoor) return null;
    return glassdoor.replace(/[)>.,]+$/g, '');
  }

  private stripNoise(lines: string[]): string[] {
    return lines.filter(line => !GLASSDOOR.NOISE.LINE_PATTERNS.some(pattern => pattern.test(line)));
  }

  private guessTitleCompanyLocation(lines: string[]): [string, string, string] {
    if (lines.length < 2) return ['', '', ''];

    const first = lines[0];
    const atMatch = first.match(GLASSDOOR.REGEX.TITLE_COMPANY_AT);
    if (atMatch) {
      const location = lines.find(line => this.looksLikeLocation(line)) ?? lines[1] ?? '';
      return [atMatch[1].trim(), atMatch[2].trim(), location.trim()];
    }

    const title = first;
    const company = lines[1] ?? '';
    const location = lines.find(line => this.looksLikeLocation(line)) ?? (lines[2] ?? '');
    return [title.trim(), company.trim(), location.trim()];
  }
}
