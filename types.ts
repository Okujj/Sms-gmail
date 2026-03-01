
export interface Lead {
  id: string;
  email: string;
  name: string;
  ageRange?: string;
  status: 'new' | 'validating' | 'valid' | 'invalid' | 'sending' | 'sent' | 'failed';
  source?: string;
  notes?: string;
}

export interface MarketInsights {
  topCountries: string[];
  rationale: string;
  trendScore: number;
  sources?: { title: string; uri: string }[];
}

export interface SearchConfig {
  query: string;
  product: string;
  targetAgeRange: string;
  campaignLink: string;
  customMessage: string;
}

export enum CampaignStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  VALIDATING = 'VALIDATING',
  SENDING = 'SENDING',
  COMPLETED = 'COMPLETED'
}
