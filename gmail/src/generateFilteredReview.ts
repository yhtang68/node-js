import fs from 'fs';
import path from 'path';
import { JOB_FILTERS, JOB_SOURCES } from './config';
import { JobFilterConfig, JobSourceConfig, SalaryRangeUsdYear } from './types';
import { getJobKey } from './utils/jobKey';
import { jobMeetsMinSalaryUsdYear } from './utils/salary';

interface ReviewJob {
  index: number;
  title: string;
  company: string;
  location: string;
  details: string[];
  link: string;
  salary?: SalaryRangeUsdYear;
}

interface ReviewEmail {
  subject: string;
  datetime: string;
  jobs: ReviewJob[];
}

interface ReviewSummary {
  sourceId: string;
  sourceEmail: string;
  displayName: string;
  totalEmails: number;
  totalJobs: number;
  createdAt: string;
  createdAtIso: string;
  filters?: JobFilterConfig;
}

interface ReviewData {
  summary: ReviewSummary;
  emails: ReviewEmail[];
}

export function generateFilteredReview(source: JobSourceConfig, filters: JobFilterConfig): ReviewData {
  const outputDir = path.join(__dirname, '../Results');
  const inputPath = path.join(outputDir, `${source.outputBaseName}-Review.json`);
  const htmlOutputPath = path.join(outputDir, `${source.outputBaseName}-Review-Filtered.html`);
  const jsonOutputPath = path.join(outputDir, `${source.outputBaseName}-Review-Filtered.json`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Review JSON not found at ${inputPath}. Generate ${path.basename(inputPath)} first.`);
  }

  const reviewData = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as ReviewData;
  const filteredData = buildFilteredReview(reviewData, filters);
  const html = buildFilteredHtml(filteredData, source);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(htmlOutputPath, html);
  fs.writeFileSync(jsonOutputPath, JSON.stringify(filteredData, null, 2));
  console.log(`${path.basename(htmlOutputPath)} generated at ${htmlOutputPath}`);
  console.log(`${path.basename(jsonOutputPath)} generated at ${jsonOutputPath}`);

  return filteredData;
}

function buildFilteredReview(reviewData: ReviewData, filters: JobFilterConfig): ReviewData {
  const sortedEmails = [...reviewData.emails].sort((a, b) => parseEmailDate(b.datetime) - parseEmailDate(a.datetime));
  const seenLinks = new Set<string>();

  const filteredEmails = sortedEmails
    .map(email => {
      const jobs = email.jobs
        .filter(job => applyJobFilters(job, filters, seenLinks))
        .map((job, index) => ({
          ...job,
          index: index + 1
        }));

      return {
        ...email,
        jobs
      };
    })
    .filter(email => email.jobs.length > 0);

  const totalJobs = filteredEmails.reduce((sum, email) => sum + email.jobs.length, 0);
  const createdAtDate = new Date();

  return {
    summary: {
      sourceId: reviewData.summary.sourceId,
      sourceEmail: reviewData.summary.sourceEmail,
      displayName: reviewData.summary.displayName,
      totalEmails: filteredEmails.length,
      totalJobs,
      createdAt: createdAtDate.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }),
      createdAtIso: createdAtDate.toISOString(),
      filters
    },
    emails: filteredEmails
  };
}

function applyJobFilters(job: ReviewJob, filters: JobFilterConfig, seenKeys: Set<string>): boolean {
  if (filters.dedupe) {
    const key = getJobKey(job);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
  }

  if (typeof filters.minSalaryUsdYear === 'number') {
    const requireSalary = Boolean(filters.requireSalaryForMinSalaryFilter);
    if (!jobMeetsMinSalaryUsdYear(job.salary, filters.minSalaryUsdYear, requireSalary)) return false;
  }

  return true;
}

function buildFilteredHtml(reviewData: ReviewData, source: JobSourceConfig): string {
  return `
  <html>
  <head>
    <title>${escapeHtml(source.displayName)} Filtered</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f1e8;
        --panel: #fffdf8;
        --panel-strong: #f2e7d5;
        --text: #1f1a16;
        --muted: #75685f;
        --line: #dccfbe;
        --accent: #0b6e4f;
        --accent-soft: #dff3ea;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 20px 48px;
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.85), transparent 28%),
          linear-gradient(180deg, #efe3cf 0%, var(--bg) 100%);
        color: var(--text);
      }
      .page {
        max-width: 960px;
        margin: 0 auto;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 2.4rem;
      }
      .summary {
        margin: 0 0 24px;
        padding: 18px 20px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 253, 248, 0.86);
      }
      .summary-title {
        margin: 0 0 10px;
        font-size: 1.15rem;
      }
      .summary strong {
        color: var(--accent);
      }
      .summary-timestamp {
        margin-top: 10px;
        color: var(--muted);
        font-size: 0.95rem;
      }
      details.email {
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--panel);
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(76, 55, 36, 0.06);
      }
      details.email[open] {
        background: #fffaf1;
      }
      summary {
        list-style: none;
        cursor: pointer;
        padding: 18px 22px;
        background: linear-gradient(180deg, var(--panel) 0%, var(--panel-strong) 100%);
      }
      summary::-webkit-details-marker { display: none; }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }
      .email-subject {
        margin: 0 0 6px;
        font-size: 1.1rem;
        font-weight: 700;
      }
      .email-date {
        color: var(--muted);
        font-size: 0.95rem;
      }
      .email-count {
        flex-shrink: 0;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.92rem;
        font-weight: 700;
      }
      .jobs {
        padding: 18px 22px 22px;
      }
      .job {
        padding: 16px 0;
        border-top: 1px solid var(--line);
      }
      .job:first-child {
        border-top: 0;
        padding-top: 0;
      }
      .job-title {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 0 0 6px;
        font-size: 1.05rem;
      }
      .job-index {
        flex-shrink: 0;
        min-width: 2.25rem;
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--panel-strong);
        color: var(--accent);
        font-size: 0.85rem;
        font-weight: 700;
        text-align: center;
      }
      .job-meta {
        margin: 0;
        color: var(--muted);
      }
      .job-details {
        margin: 10px 0 0;
        padding-left: 18px;
        color: var(--text);
      }
      .job-link {
        display: inline-block;
        margin-top: 12px;
        color: var(--accent);
        font-weight: 700;
        text-decoration: none;
      }
      .job-link:hover {
        text-decoration: underline;
      }
      @media (max-width: 700px) {
        body { padding: 20px 12px 36px; }
        .summary-row {
          flex-direction: column;
        }
        .email-count {
          align-self: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>${escapeHtml(source.displayName)} Filtered</h1>
      <p class="summary">
        <strong class="summary-title">Summary</strong><br />
        Total emails from <strong>${escapeHtml(reviewData.summary.sourceEmail)}</strong> with filtered jobs: <strong>${reviewData.summary.totalEmails}</strong><br />
        Total unique jobs: <strong>${reviewData.summary.totalJobs}</strong>
        <span class="summary-timestamp"><br />Created: <strong>${escapeHtml(reviewData.summary.createdAt)}</strong></span>
      </p>
      ${reviewData.emails.map((email, index) => `
        <details class="email" ${index === 0 ? 'open' : ''}>
          <summary>
            <div class="summary-row">
              <div>
                <div class="email-subject">${escapeHtml(email.subject)}</div>
                <div class="email-date">${escapeHtml(email.datetime)}</div>
              </div>
              <div class="email-count">${email.jobs.length} jobs</div>
            </div>
          </summary>
          <div class="jobs">
            ${email.jobs.map(job => `
              <article class="job">
                <h2 class="job-title"><span class="job-index">#${job.index}</span><span>${escapeHtml(job.title)}</span></h2>
                <p class="job-meta">${escapeHtml([job.company, job.location, job.salary?.text].filter(Boolean).join(' | '))}</p>
                ${job.details.length
                  ? `<ul class="job-details">${job.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
                  : ''}
                <a class="job-link" href="${escapeAttribute(job.link)}" target="_blank" rel="noreferrer">Open job</a>
              </article>
            `).join('')}
          </div>
        </details>
      `).join('')}
    </div>
  </body>
  </html>
  `;
}

function parseEmailDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

if (require.main === module) {
  for (const source of JOB_SOURCES) {
    generateFilteredReview(source, JOB_FILTERS[source.id]);
  }
}
