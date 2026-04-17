import fs from 'fs';
import path from 'path';
import { JOB_FILTERS, JOB_SOURCES } from './config';
import { generateFilteredReview } from './generateFilteredReview';
import { generateReview } from './generateReview';
import { JobEmail, JobSourceId, RawJobPosting } from './types';
import { BaseJobEmailParser } from './parsers/BaseJobEmailParser';
import { LinkedInEmailParser } from './parsers/LinkedInParser';
import { GlassdoorEmailParser } from './parsers/GlassdoorParser';
import { LensaEmailParser } from './parsers/LensaParser';

const SAMPLE_FILES: Record<JobSourceId, string> = {
  LinkedIn: path.join(__dirname, '../Sample/LinkedIn.eml'),
  Glassdoor: path.join(__dirname, '../Sample/Glassdoor.eml'),
  Lensa: path.join(__dirname, '../Sample/Lensa.eml')
};

type ParserWithRawEml = BaseJobEmailParser & {
  parseJobsFromRawEml(rawEml: string): RawJobPosting[];
};

const PARSERS: Record<JobSourceId, ParserWithRawEml> = {
  LinkedIn: new LinkedInEmailParser(),
  Glassdoor: new GlassdoorEmailParser(),
  Lensa: new LensaEmailParser()
};

for (const source of JOB_SOURCES) {
  const samplePath = SAMPLE_FILES[source.id];
  if (!fs.existsSync(samplePath)) {
    console.warn(`Sample file not found: ${samplePath}`);
    continue;
  }

  const parser = PARSERS[source.id];
  const rawEml = fs.readFileSync(samplePath, 'utf8');
  const rawJobs = parser.parseJobsFromRawEml(rawEml);
  const jobs = parser.toJobPostings(rawJobs);
  const email: JobEmail = {
    subject: extractHeader(rawEml, 'Subject'),
    date: extractHeader(rawEml, 'Date'),
    jobs
  };

  console.log(`[${source.id}] Parsed ${jobs.length} jobs from ${path.relative(process.cwd(), samplePath)}`);

  generateReview(source, [email]);
  generateFilteredReview(source, JOB_FILTERS[source.id]);
}

function extractHeader(rawEml: string, headerName: string): string {
  const escaped = headerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}:\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)`, 'im');
  const match = rawEml.match(regex);
  if (!match) return '';
  return match[1].replace(/\r?\n[ \t]+/g, ' ').trim();
}

