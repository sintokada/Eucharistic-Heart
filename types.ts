export interface Miracle {
  id: string;
  title: string;
  location: string;
  date: string;
  description: string;
  science: string;
  fullStory?: string;
}

export interface Prayer {
  id: string;
  title: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum AppView {
  HOME = 'HOME',
  ADORATION = 'ADORATION',
  MIRACLES = 'MIRACLES',
  PRAYERS = 'PRAYERS',
  CHAT = 'CHAT'
}