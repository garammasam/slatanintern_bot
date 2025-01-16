import { ILanguageAgent } from '../types';
import { OpenAI } from 'openai';

export class LanguageAgent implements ILanguageAgent {
  private openai: OpenAI;
  private sassLevels: Map<string, number> = new Map();
  private readonly MAX_SASS = 10;
  private readonly SASS_INCREMENT = 0.5;

  // Common KL Malay expressions and their contexts
  private readonly KL_EXPRESSIONS = {
    agreement: ['betul tu', 'ye lah', 'mmg la', 'dah la tu', 'ok wat'],
    disagreement: ['mana boleh', 'tak gitu la', 'eh tak la pulak', 'mende la', 'tak kot'],
    excitement: ['best gila', 'power la', 'gempak', 'mantap', 'terbaik'],
    skepticism: ['ye ke', 'ish', 'tak caya la', 'eh serious?', 'betul ke ni'],
    acknowledgment: ['faham2', 'ok ah', 'boleh la', 'takpe2'],
    common_particles: ['la', 'wei', 'eh', 'kan', 'kot', 'sial', 'bro', 'doh']
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
            content: `You're a KL youth. Suggest a natural response style that:
                     1. Uses KL Malay slang (NEVER Indonesian)
                     2. Mixes English naturally when appropriate
                     3. Keeps it casual and authentic to KL
                     4. Uses common particles (la, wei, eh, kan, kot)
                     
                     Examples:
                     - "tak boleh la macam tu wei"
                     - "confirm best gila"
                     - "eh mende ni actually"
                     - "ok wat, takpe2"
                     
                     Return null if no specific style needed.`
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 100
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
    return expressions[Math.floor(Math.random() * expressions.length)];
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
            content: `You're a KL youth with sass level ${sassLevel}/10. Enhance the response:
                     1. Use KL Malay (NEVER Indonesian) mixed with English
                     2. Keep original meaning but add KL attitude
                     3. Use particles naturally (la, wei, eh, kan, kot)
                     4. Add playful teasing based on sass level
                     5. Keep it concise and natural
                     
                     Sass guidelines by level:
                     - Level 0-3: "takpe2 la wei" style
                     - Level 4-6: "eh mende la you ni" style
                     - Level 7-10: "confirm la noob" style
                     
                     Examples:
                     - "tak boleh la macam tu wei"
                     - "confirm best gila"
                     - "eh serious la you?"
                     - "ok je kot actually"
                     
                     Current sass level: ${sassLevel}`
          },
          {
            role: "user",
            content: response
          }
        ],
        temperature: 0.7 + (sassLevel / 20),
        max_tokens: 150
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