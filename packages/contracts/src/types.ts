export type CreatureType = 'vampire' | 'werewolf' | 'fairy';
export type ThemeType = 'betrayal' | 'obsession' | 'power_dynamics' | 'forbidden_love' | 'revenge' | 'manipulation' | 'seduction' | 'dark_secrets' | 'corruption' | 'dominance' | 'submission' | 'jealousy' | 'temptation' | 'sin' | 'desire' | 'passion' | 'lust' | 'deceit';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type WordCount = 700 | 900 | 1200;
export type VoiceType = 'female' | 'male' | 'neutral';
export type AudioSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;
export type AudioFormat = 'mp3' | 'wav' | 'aac';
export type ExportFormat = 'pdf' | 'txt' | 'html' | 'epub' | 'docx';

export interface AudioProgress {
  percentage: number; // 0-100
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  estimatedTimeRemaining?: number; // in seconds
}
