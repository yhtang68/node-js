import { BaseJobEmailParser, JobRecord, ParseJobsFromMessageInput } from './BaseJobEmailParser';
import { JobEmail, RawJobPosting } from '../types';
import { decodeGmailBodyData } from '../utils/gmail';

const LINKEDIN = {
  QUERY: {
    SEARCH: 'from:jobalerts-noreply@linkedin.com'
  },
  PREFIX: {
    VIEW_JOB: 'View job: '
  },
  REGEX: {
    JOB_SECTION_SPLIT: /-{20,}/,
    JOB_ID_IN_LINK: /\/jobs\/view\/(\d+)/,
    SECTION_LINE_SPLIT: /\r?\n/,
    NOISE_PATTERNS: [
      /^your job alert /i,
      /^\d+\+? new jobs match /i,
      /^new jobs match /i,
      /^results from the new ai-powered job search$/i
    ]
  },
  MIN: {
    CONTENT_LINES: 3
  }
} as const;

export async function fetchJobEmails_LinkedIn(): Promise<JobEmail[]> {
  return new LinkedInEmailParser().fetchJobEmails();
}

export class LinkedInEmailParser extends BaseJobEmailParser {
  protected readonly searchQuery = LINKEDIN.QUERY.SEARCH;

  protected async parseJobsFromMessage(input: ParseJobsFromMessageInput): Promise<RawJobPosting[]> {
    const body = this.extractPlainText(input.payload);
    return this.parseJobsFromBody(body);
  }

  protected getJobKey(job: RawJobPosting): string {
    const linkedInMatch = job.link.match(LINKEDIN.REGEX.JOB_ID_IN_LINK);
    if (linkedInMatch) return `linkedin:${linkedInMatch[1]}`;
    return `linkedin:${job.title}|${job.company}|${job.location}`.toLowerCase();
  }

  public parseJobsFromRawEml(rawEml: string): RawJobPosting[] {
    const plainBody = this.extractPartBodyFromRawEml(rawEml, 'text/plain');
    return this.parseJobsFromBody(plainBody);
  }

  private extractPlainText(
    payload: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: any[] | null } | undefined
  ): string {
    if (!payload) return '';

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return decodeGmailBodyData(payload.body.data);
    }

    for (const part of payload.parts || []) {
      const text = this.extractPlainText(part);
      if (text) return text;
    }

    return '';
  }

  private parseJobsFromBody(body: string): RawJobPosting[] {
    if (!body) return [];

    const sections = body.split(LINKEDIN.REGEX.JOB_SECTION_SPLIT);
    const jobs: RawJobPosting[] = [];

    for (const section of sections) {
      const job = this.parseJobSection(section);
      if (job) jobs.push(job);
    }

    return jobs;
  }

  private parseJobSection(section: string): RawJobPosting | null {
    const lines = section
      .split(LINKEDIN.REGEX.SECTION_LINE_SPLIT)
      .map(line => line.trim())
      .filter(Boolean);

    const linkLine = lines.find(line => line.startsWith(LINKEDIN.PREFIX.VIEW_JOB));
    if (!linkLine) return null;

    const link = linkLine.replace(LINKEDIN.PREFIX.VIEW_JOB, '').trim();
    const contentLines = this.stripLeadingNoise(lines.filter(line => line !== linkLine));

    if (contentLines.length < LINKEDIN.MIN.CONTENT_LINES) return null;

    const [title, company, location, ...details] = contentLines;

    const jobRecord = new JobRecord();
    jobRecord.title = title;
    jobRecord.company = company;
    jobRecord.location = location;
    jobRecord.link = link;
    jobRecord.addDetails(details);
    return jobRecord.toRawJobPosting();
  }

  private stripLeadingNoise(lines: string[]): string[] {
    let startIndex = 0;
    while (startIndex < lines.length && LINKEDIN.REGEX.NOISE_PATTERNS.some(pattern => pattern.test(lines[startIndex]))) {
      startIndex += 1;
    }

    return lines.slice(startIndex);
  }
}
