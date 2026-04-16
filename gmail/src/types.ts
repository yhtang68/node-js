export type JobSourceId = 'LinkedIn' | 'Glassdoor';

export interface SalaryRangeUsdYear {
  text: string;
  minUsd?: number;
  maxUsd?: number;
}

export interface JobPosting {
  title: string;
  company: string;
  location: string;
  details: string[];
  link: string;
  salary?: SalaryRangeUsdYear;
}

export interface JobEmail {
  subject: string;
  date: string;
  jobs: JobPosting[];
}

export interface JobSourceConfig {
  id: JobSourceId;
  fromEmail: string;
  displayName: string;
  outputBaseName: string;
}

export interface JobFilterConfig {
  dedupe: boolean;
  minSalaryUsdYear?: number;
  requireSalaryForMinSalaryFilter?: boolean;
}

