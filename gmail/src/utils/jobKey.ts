import { JobPosting } from '../types';

export function getJobKey(job: Pick<JobPosting, 'title' | 'company' | 'location' | 'link'>): string {
  const linkedInMatch = job.link.match(/\/jobs\/view\/(\d+)/);
  if (linkedInMatch) return `linkedin:${linkedInMatch[1]}`;

  const glassdoorIdMatch = job.link.match(/[?&]jobListingId=(\d+)/i);
  if (glassdoorIdMatch) return `glassdoor:${glassdoorIdMatch[1]}`;

  const glassdoorJlMatch = job.link.match(/\bJL_(\d+)\b/i);
  if (glassdoorJlMatch) return `glassdoor:JL_${glassdoorJlMatch[1]}`;

  return `${job.title}|${job.company}|${job.location}`.toLowerCase();
}

