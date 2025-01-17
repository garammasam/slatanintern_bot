import { ILanguageAgent } from '../types';
import { OpenAI } from 'openai';

export class LanguageAgent implements ILanguageAgent {
  private openai: OpenAI;
  private sassLevels: Map<string, number> = new Map();
  private readonly MAX_SASS = 10;
  private readonly SASS_INCREMENT = 0.5;

  private readonly SLANG_PATTERNS = {
    greetings: {
      morning: ['boss pagi', 'morning boss', 'pagi2'],
      afternoon: ['boss tgh hari ni', 'lunch time dah boss'],
      evening: ['petang dah boss', 'boss ptg ni'],
      night: ['malam dah boss', 'boss night2']
    },
    reactions: {
      positive: ['best la', 'padu', 'poyo', 'terbaik'],
      negative: ['potong stim', 'boring gila', 'menyampah'],
      surprise: ['bengong', 'terkejut dowh', 'gila apa'],
      agreement: ['betul tu boss', 'sama la', 'ikr boss']
    },
    expressions: {
      emphasis: ['confirm', 'legit', 'real', 'betul2'],
      doubt: ['ye ke', 'suspicious', 'sus', 'tak caya'],
      excitement: ['hype gila', 'cant wait la', 'lesgo'],
      disappointment: ['potong stim', 'bad la', 'gg']
    },
    gamingTerms: {
      praise: ['pro la boss', 'carry', 'mvp'],
      criticism: ['noob la', 'bot', 'throw'],
      status: ['afk', 'brb', 'otw']
    }
  };

  constructor() {
    console.log('🗣️ LanguageAgent: Initializing...');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  public async initialize(): Promise<void> {
    console.log('🗣️ LanguageAgent: Ready to process language');
  }

  public async shutdown(): Promise<void> {
    console.log('🗣️ LanguageAgent: Shutting down');
  }

  public async enrichSlangContext(message: string): Promise<string[]> {
    console.log('🔍 LanguageAgent: Enriching slang context');
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are a KL-based language expert. Analyze the message for:
                     1. KL Malay slang and informal expressions (NOT Indonesian)
                     2. English words/phrases commonly used by KL youth
                     3. Context and tone indicators
                     
                     Language guidelines:
                     - Use Malaysian Malay ONLY (never Indonesian)
                     - Mix with English naturally like KL youth
                     - Common particles: la, wei, eh, kan, kot, sia
                     - Casual/informal KL style
                     - Keep analysis brief and natural
                     
                     Return empty array if no significant patterns found.`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const response = completion.choices[0].message.content;
      if (!response) return [];

      try {
        return JSON.parse(response);
      } catch {
        return response.split('\n').filter(line => line.trim().length > 0);
      }
    } catch (error) {
      console.error('🔍 LanguageAgent: Error analyzing slang:', error);
      return [];
    }
  }

  public async getSlangResponse(message: string): Promise<string | null> {
    console.log('🎯 LanguageAgent: Getting response style');
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You're chatting with friends in KL style. Keep it real:

                     Rules:
                     1. Use daily KL chat style
                     2. Mix Malay/English naturally
                     3. Keep it super short
                     4. Match the exact topic/mood
                     
                     Examples:
                     User: "boring gila hari ni"
                     Reply: "same la bro"
                     
                     User: "eh tengok movie tak semalam"
                     Reply: "movie apa eh?"
                     
                     User: "makan apa best kat area ni"
                     Reply: "mamak je paling best kot"
                     
                     Return null if no specific style needed.`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      });

      const response = completion.choices[0].message.content;
      return response || null;
    } catch (error) {
      console.error('🎯 LanguageAgent: Error getting response style:', error);
      return null;
    }
  }

  private getSassLevel(groupId: string): number {
    const currentLevel = this.sassLevels.get(groupId) || 0;
    const newLevel = Math.min(currentLevel + this.SASS_INCREMENT, this.MAX_SASS);
    this.sassLevels.set(groupId, newLevel);
    return newLevel;
  }

  public async enhanceResponse(response: string, groupId: string): Promise<string> {
    try {
      // First pass: Basic slang enhancement
      let enhanced = await this.addLocalSlang(response);
      
      // Second pass: Add emotional markers
      enhanced = this.addEmotionalMarkers(enhanced);
      
      return enhanced;
    } catch (error) {
      console.error('🗣️ Error enhancing response:', error);
      return response;
    }
  }

  public async addLocalSlang(text: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: `Enhance this message with natural KL slang. Rules:
            1. Keep the same meaning
            2. Make it sound more natural/local
            3. Use appropriate Malaysian particles (la, wei, eh) - but only if they fit naturally
            4. Mix English and Malay naturally
            5. Keep it short and authentic
            6. Don't add particles if message already has them`
        },
        { role: "user", content: text }
      ],
      temperature: 0.7,
      max_tokens: 60
    });

    return completion.choices[0].message.content || text;
  }

  public addEmotionalMarkers(text: string): string {
    // Add emojis based on message content and tone
    const emotionPatterns = [
      { regex: /happy|best|nice|good/i, emoji: '😄' },
      { regex: /sad|bad|worst|terrible/i, emoji: '😢' },
      { regex: /angry|mad|upset/i, emoji: '😤' },
      { regex: /funny|lol|haha/i, emoji: '🤣' },
      { regex: /food|makan|hungry/i, emoji: '🍜' },
      { regex: /game|play|noob/i, emoji: '🎮' }
    ];

    let result = text;
    emotionPatterns.forEach(({ regex, emoji }) => {
      if (regex.test(text.toLowerCase())) {
        result = `${result} ${emoji}`;
      }
    });

    return result;
  }
} 