import fs from 'fs';
import path from 'path';
import { JobEmail } from './fetchJobs';

export function generateHTML(jobs: JobEmail[]) {
  const totalJobCount = jobs.reduce((sum, email) => sum + email.jobs.length, 0);
  const createdAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
  const html = `
  <html>
  <head>
    <title>LinkedIn Job Review</title>
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
      .empty {
        margin: 0;
        color: var(--muted);
        font-style: italic;
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
      <h1>LinkedIn Job Alerts Review</h1>
      <p class="summary">
        <strong class="summary-title">Summary</strong><br />
        Total emails from <strong>jobalerts-noreply@linkedin.com</strong>: <strong>${jobs.length}</strong><br />
        Total jobs parsed from those emails: <strong>${totalJobCount}</strong>
        <span class="summary-timestamp"><br />Created: <strong>${escapeHtml(createdAt)}</strong></span>
      </p>
      ${jobs.map((email, index) => `
        <details class="email" ${index === 0 ? 'open' : ''}>
          <summary>
            <div class="summary-row">
              <div>
                <div class="email-subject">${escapeHtml(email.subject)}</div>
                <div class="email-date">${escapeHtml(email.date)}</div>
              </div>
              <div class="email-count">${email.jobs.length} jobs</div>
            </div>
          </summary>
          <div class="jobs">
            ${email.jobs.length
              ? email.jobs.map((job, jobIndex) => `
                <article class="job">
                  <h2 class="job-title"><span class="job-index">#${jobIndex + 1}</span><span>${escapeHtml(job.title)}</span></h2>
                  <p class="job-meta">${escapeHtml(job.company)} | ${escapeHtml(job.location)}</p>
                  ${job.details.length
                    ? `<ul class="job-details">${job.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
                    : ''}
                  <a class="job-link" href="${escapeAttribute(job.link)}" target="_blank" rel="noreferrer">Open job</a>
                </article>
              `).join('')
              : '<p class="empty">No individual jobs were parsed from this email.</p>'}
          </div>
        </details>
      `).join('')}
    </div>
  </body>
  </html>
  `;

  fs.writeFileSync(path.join(__dirname, '../Review-Linked-In-Jobs.html'), html);
  console.log('Review-Linked-In-Jobs.html generated!');
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
