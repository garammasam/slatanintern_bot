import { ILanguageAgent } from '../types';
import { OpenAI } from 'openai';

export class LanguageAgent implements ILanguageAgent {
  private openai: OpenAI;
  private sassLevels: Map<string, number> = new Map();
  private readonly MAX_SASS = 10;
  private readonly SASS_INCREMENT = 0.5;

  // Common KL Malay expressions and their contexts
  private readonly KL_EXPRESSIONS = {
    greetings: {
      morning: ['pagi boss', 'pagi2', 'morning'],
      afternoon: ['tgh hari', 'lunch time ni', 'ptg ni'],
      evening: ['petang dah ni', 'dah petang rupanya'],
      night: ['malam dah', 'night2']
    },
    casual: ['jom', 'ok', 'hmm', 'eh', 'oi', 'weh', 'dey'],
    acknowledgment: ['ye la tu', 'betul3', 'ok ah', 'boleh la', 'mmg la'],
    agreement: ['sama la', 'ye doh', 'betul jugak', 'kan?'],
    questions: ['cemana?', 'apa bikin?', 'ok tak?', 'best ke?']
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

  private getRandomExpression(type: keyof typeof this.KL_EXPRESSIONS): string {
    const expressions = this.KL_EXPRESSIONS[type];
    if (Array.isArray(expressions)) {
      return expressions[Math.floor(Math.random() * expressions.length)];
    } else if (type === 'greetings') {
      const timeKeys = Object.keys(expressions) as Array<keyof typeof expressions>;
      const randomKey = timeKeys[Math.floor(Math.random() * timeKeys.length)];
      const timeExpressions = expressions[randomKey];
      return timeExpressions[Math.floor(Math.random() * timeExpressions.length)];
    }
    return '';
  }

  public async enhanceResponse(response: string, groupId: string): Promise<string> {
    console.log('✨ LanguageAgent: Enhancing response');
    try {
      const sassLevel = this.getSassLevel(groupId);
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You're a KL youth. Reply like texting a friend. Keep it real and simple.

                     Rules:
                     1. One short sentence only
                     2. Use "aku/ko" style
                     3. Must answer the question/topic directly
                     4. No asking questions back unless necessary
                     5. No unnecessary words or formalities
                     
                     Examples:
                     Q: "harini sorok jumaat kat mana?"
                     A: "aku dengar kat lot 10 kot"
                     
                     Q: "eh lapar la"
                     A: "jom mamak"
                     
                     Q: "bila meeting?"
                     A: "4 petang kot"`
          },
          {
            role: "user",
            content: response
          }
        ],
        temperature: 0.7,
        max_tokens: 40
      });

      const enhancedResponse = completion.choices[0].message.content;
      if (!enhancedResponse) return response;

      console.log(`✨ LanguageAgent: Response enhanced (Sass Level: ${sassLevel})`);
      return enhancedResponse;
    } catch (error) {
      console.error('✨ LanguageAgent: Error enhancing response:', error);
      return response;
    }
  }
} 