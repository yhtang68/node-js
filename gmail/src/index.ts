import { JOB_FILTERS, JOB_SOURCES } from './config';
import { fetchJobEmails_Glassdoor } from './parsers/GlassdoorParser';
import { fetchJobEmails_LinkedIn } from './parsers/LinkedInParser';
import { fetchJobEmails_Lensa } from './parsers/LensaParser';
import { generateFilteredReview } from './generateFilteredReview';
import { generateReview } from './generateReview';
import { JobEmail, JobSourceId } from './types';

function isDebugModeFromArgs(): boolean {
  return process.argv.includes('--debug');
}

function formatUsdYearCompact(value?: number): string | undefined {
  if (typeof value !== 'number') return undefined;
  if (value >= 1000) {
    const inThousands = value / 1000;
    const formatted = Number.isInteger(inThousands) ? inThousands.toString() : inThousands.toFixed(1);
    return `$${formatted}K`;
  }
  return `$${value}`;
}

async function main(debugMode: boolean = false) {
  const fetchers: Record<JobSourceId, () => Promise<JobEmail[]>> = {
    LinkedIn: fetchJobEmails_LinkedIn,
    Glassdoor: fetchJobEmails_Glassdoor,
    Lensa: fetchJobEmails_Lensa
  };

  for (const source of JOB_SOURCES) {
    console.log(`Fetching ${source.displayName} emails from ${source.fromEmail}...`);
    const emails = await fetchers[source.id]();
    console.log(`Fetched ${emails.length} emails. Generating review...`);

    const reviewData = generateReview(source, emails, {
      writeJson: debugMode
    });

    const filterInfo = {
      filter: {
        dedupe: JOB_FILTERS[source.id].dedupe,
        minSalaryUsdYear: formatUsdYearCompact(JOB_FILTERS[source.id].minSalaryUsdYear)
      }
    };
    console.log(`Generating filtered review with\n${JSON.stringify(filterInfo, null, 2)}`);

    generateFilteredReview(source, JOB_FILTERS[source.id], {
      reviewData,
      writeJson: debugMode
    });
    console.log('---');
  }

  console.log('Done!');
}

main(isDebugModeFromArgs()).catch(err => {
  console.error('Error:', err);
});
