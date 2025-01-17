import { Context } from 'grammy';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface BotConfig {
  telegramToken: string;
  openaiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  groupIds: string[];
  responseThreshold: number;
  messageHistory: Map<string, Message[]>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface PollInfo {
  userId: number;
  pollId: string;
  messageId: number;
  startTime: number;
  timer: NodeJS.Timeout;
}

export interface Show {
  id: string;
  title: string;
  type: 'Concert' | 'Festival';
  status: 'upcoming' | 'completed';
  artists: string[];
  date: string;
  venue: string;
  venue_type: 'Indoor' | 'Outdoor';
  location: string;
  description: string;
  ticket_link?: string;
  setlist?: Array<{
    type: string;
    title: string;
    artist: string;
    duration: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  title: string;
  artist: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  deadline: string;
  start_date: string;
  genre: string;
  tracks: ProjectTrack[];
  collaborators: string[];
}

export interface ProjectTrack {
  id: number;
  title: string;
  status: 'WRITING' | 'RECORDING' | 'MIXING' | 'MASTERING';
  features: string[];
  notes?: string;
  demoLink?: string;
  bpm?: string;
  key?: string;
  duration?: string;
  recordingLocation?: string;
}

export interface CatalogTrack {
  id: string;
  title: string;
  artist: string[];
  language: string;
  duration: string;
  release_date: string;
  isrc: string;
  link?: string;
  type: string;
}

export interface SlangEntry {
  word: string;
  meaning: string;
  context: string;
  category: 'callout' | 'agreement' | 'disagreement' | 'praise' | 'criticism' | 'general';
  examples: string[];
  responses: string[];
}

export interface SlangDatabase {
  [key: string]: SlangEntry;
}

export interface Quote {
  text: string;
  author: string;
}

// Agent interfaces
export interface IAgent {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ICoreAgent extends IAgent {
  start(): Promise<void>;
  stop(): Promise<void>;
  getBot(): any;
  getConfig(): BotConfig;
}

export interface IMessageAgent extends IAgent {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  handleMessage(ctx: Context): Promise<void>;
  new?(
    coreAgent: ICoreAgent,
    conversationAgent: IConversationAgent,
    moderationAgent: IModerationAgent,
    inquiryAgent: IInquiryAgent,
    databaseAgent: IDatabaseAgent
  ): IMessageAgent;
}

export interface IConversationAgent extends IAgent {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  updateHistory(groupId: string, message: Message): void;
  generateResponse(groupId: string): Promise<string | null>;
  enrichContext(groupId: string): Promise<ChatCompletionMessageParam[]>;
  canUserSendMessage(userId: string): boolean;
  canGroupReceiveResponse(groupId: string): boolean;
}

export interface IModerationAgent extends IAgent {
  handleKickCommand(ctx: Context): Promise<void>;
  createKickPoll(ctx: Context, userToKick: number, username: string): Promise<any>;
  processPollResults(ctx: Context, messageId: number, userToKick: number): Promise<void>;
  shouldModerateMessage(ctx: Context): Promise<boolean>;
}

export interface ArtistInfo {
  catalogs: any[];
  shows: Show[];
  projects: Project[];
}

export interface IDatabaseAgent extends IAgent {
  getUpcomingShows(): Promise<Show[]>;
  getProjects(status?: 'IN_PROGRESS' | 'COMPLETED'): Promise<Project[]>;
  searchArtistInfo(query: string): Promise<any>;
  processArtistQuery(text: string): Promise<string>;
}

export interface TopicContext {
  mainTopic: string;
  emotionalTone: number;
  responseStyle: string;
}

export interface ConversationState {
  lastTopics: string[];
  userInteractions: Map<string, {
    lastInteraction: number;
    topicPreferences: string[];
    responseStyle: string;
  }>;
  groupContext: Map<string, {
    activeTopics: string[];
    vibeLevel: number;
    lastActivity: number;
  }>;
}

export interface ILanguageAgent {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  enrichSlangContext(message: string): Promise<string[]>;
  getSlangResponse(message: string): Promise<string | null>;
  enhanceResponse(response: string, groupId: string): Promise<string>;
  addLocalSlang(text: string): Promise<string>;
  addEmotionalMarkers(text: string): string;
}

export interface ISchedulerAgent extends IAgent {
  setupMorningGreeting(): void;
  setupNightGreeting(): void;
  generateDailyQuote(type: 'morning' | 'night'): Promise<Quote>;
}

export interface IInquiryAgent extends IAgent {
  handleMerchInquiry(): string;
  handleSocialInquiry(): string;
  handleArtistInquiry(query: string): Promise<string>;
  isMerchInquiry(text: string): boolean;
  isSocialInquiry(text: string): boolean;
} 