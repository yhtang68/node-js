import { JobFilterConfig, JobSourceConfig } from './types';

export const JOB_SOURCES: JobSourceConfig[] = [
  {
    id: 'LinkedIn',
    fromEmail: 'jobalerts-noreply@linkedin.com',
    displayName: 'LinkedIn Job Alerts',
    outputBaseName: 'Linked-In-Jobs'
  },
  {
    id: 'Glassdoor',
    fromEmail: 'noreply@glassdoor.com',
    displayName: 'Glassdoor Job Alerts',
    outputBaseName: 'Glassdoor-Jobs'
  }
];

export const JOB_FILTERS: Record<JobSourceConfig['id'], JobFilterConfig> = {
  LinkedIn: {
    dedupe: true
  },
  Glassdoor: {
    dedupe: true,
    minSalaryUsdYear: 200_000,
    requireSalaryForMinSalaryFilter: true
  }
};

