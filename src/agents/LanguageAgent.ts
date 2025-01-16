import { ILanguageAgent } from '../types';
import { OpenAI } from 'openai';

export class LanguageAgent implements ILanguageAgent {
  private openai: OpenAI;
  private sassLevels: Map<string, number> = new Map();
  private readonly MAX_SASS = 10;
  private readonly SASS_INCREMENT = 0.5;

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
            content: `Analyze the given message for Malaysian/Kelantanese slang or informal expressions.
                     Return an array of insights about the language used.
                     Focus on:
                     1. Informal expressions and their meanings
                     2. Cultural context
                     3. Appropriate response tone
                     Keep insights brief and natural.
                     Return empty array if no significant language patterns found.`
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
        // Try to parse as JSON array first
        return JSON.parse(response);
      } catch {
        // If not JSON, split by newlines and clean up
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
            content: `Given the message, suggest a natural response style that:
                     1. Matches the tone and formality
                     2. Uses appropriate Malaysian expressions
                     3. Keeps the response casual and authentic
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

  public async enhanceResponse(response: string, groupId: string): Promise<string> {
    console.log('✨ LanguageAgent: Enhancing response');
    try {
      const sassLevel = this.getSassLevel(groupId);
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `Enhance the given response with sass level ${sassLevel}/10:
                     1. Keep the original meaning but add attitude
                     2. Make it sound more casual and authentic
                     3. Add playful teasing or mild roasting
                     4. Add at most one emoji if appropriate
                     5. Keep it concise
                     6. Sass guidelines by level:
                        - Level 0-3: Slightly playful, occasional teasing
                        - Level 4-6: More sarcastic, witty comebacks
                        - Level 7-10: Full sass mode, playful roasting
                     Current sass level: ${sassLevel}`
          },
          {
            role: "user",
            content: response
          }
        ],
        temperature: 0.7 + (sassLevel / 20), // Increase randomness with sass
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