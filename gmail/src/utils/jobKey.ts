import { JobPosting, JobSourceId } from '../types';

type JobKeyInput = Pick<JobPosting, 'title' | 'company' | 'location' | 'link'>;

const sourceKeyExtractors: Record<JobSourceId, (job: JobKeyInput) => string | undefined> = {
  LinkedIn: job => {
    const linkedInMatch = job.link.match(/\/jobs\/view\/(\d+)/);
    return linkedInMatch ? `linkedin:${linkedInMatch[1]}` : undefined;
  },
  Glassdoor: job => {
    const glassdoorIdMatch = job.link.match(/[?&]jobListingId=(\d+)/i);
    if (glassdoorIdMatch) return `glassdoor:${glassdoorIdMatch[1]}`;

    const glassdoorJlMatch = job.link.match(/\bJL_(\d+)\b/i);
    return glassdoorJlMatch ? `glassdoor:JL_${glassdoorJlMatch[1]}` : undefined;
  },
  Lensa: job => {
    const upnMatch = job.link.match(/[?&]upn=([^&]+)/i);
    return upnMatch ? `lensa:${upnMatch[1].toLowerCase()}` : undefined;
  }
};

export function getJobKey(
  sourceId: JobSourceId,
  job: JobKeyInput
): string {
  const sourceKey = sourceKeyExtractors[sourceId](job);
  if (sourceKey) return sourceKey;

  return `${sourceId.toLowerCase()}:${job.title}|${job.company}|${job.location}`.toLowerCase();
}
