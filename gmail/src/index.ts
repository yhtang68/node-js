import { JOB_FILTERS, JOB_SOURCES } from './config';
import { fetchJobEmails_Glassdoor } from './fetchJobs_Glassdoor';
import { fetchJobEmails_LinkedIn } from './fetchJobs_LinkedIn';
import { fetchJobEmails_Lensa } from './fetchJobs_Lensa';
import { generateFilteredReview } from './generateFilteredReview';
import { generateReview } from './generateReview';
import { JobEmail, JobSourceId } from './types';

async function main() {
  const fetchers: Record<JobSourceId, () => Promise<JobEmail[]>> = {
    LinkedIn: fetchJobEmails_LinkedIn,
    Glassdoor: fetchJobEmails_Glassdoor,
    Lensa: fetchJobEmails_Lensa
  };

  for (const source of JOB_SOURCES) {
    console.log(`Fetching ${source.displayName} emails from ${source.fromEmail}...`);
    const emails = await fetchers[source.id]();
    console.log(`Fetched ${emails.length} emails. Generating review...`);
    generateReview(source, emails);

    console.log(`Generating filtered review (dedupe${JOB_FILTERS[source.id].minSalaryUsdYear ? ` + minSalary=$${JOB_FILTERS[source.id].minSalaryUsdYear}` : ''})...`);
    generateFilteredReview(source, JOB_FILTERS[source.id]);
    console.log('---');
  }

  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
});
