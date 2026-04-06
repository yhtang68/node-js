import { fetchJobEmails, deduplicateJobs } from './fetchJobs';
import { generateReview } from './generateReview';

async function main() {
  console.log('Fetching LinkedIn job emails...');
  const emails = await fetchJobEmails();

  console.log(`Fetched ${emails.length} emails. Deduplicating...`);
  const jobs = deduplicateJobs(emails);

  console.log(`Deduplicated jobs count: ${jobs.length}. Generating review...`);
  generateReview(jobs);

  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
});
