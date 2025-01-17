import { ILanguageAgent } from '../types';
import { OpenAI } from 'openai';
import { AMAT_PERSONALITY } from '../config/amat-personality';

export class LanguageAgent implements ILanguageAgent {
  private openai: OpenAI;
  private sassLevels: Map<string, number> = new Map();
  private readonly MAX_SASS = AMAT_PERSONALITY.sassiness.max;
  private readonly SASS_INCREMENT = AMAT_PERSONALITY.sassiness.increment;

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
    const currentLevel = this.sassLevels.get(groupId) || AMAT_PERSONALITY.sassiness.default;
    const newLevel = Math.min(currentLevel + this.SASS_INCREMENT, this.MAX_SASS);
    this.sassLevels.set(groupId, newLevel);
    return newLevel;
  }

  public async enhanceResponse(response: string, groupId: string): Promise<string> {
    try {
      const sassLevel = this.getSassLevel(groupId);
      const personality = this.getPersonalityPrompt(sassLevel);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: personality
          },
          { role: "user", content: response }
        ],
        temperature: 0.8,
        max_tokens: 150
      });

      const enhanced = completion.choices[0].message.content || response;
      return this.addEmotionalMarkers(enhanced);
    } catch (error) {
      console.error('🗣️ Error enhancing response:', error);
      return response;
    }
  }

  private getPersonalityPrompt(sassLevel: number): string {
    const { core, sassiness, contextModifiers } = AMAT_PERSONALITY;
    
    let personalityType = 'chill';
    if (sassLevel >= sassiness.thresholds.savage) personalityType = 'savage';
    else if (sassLevel >= sassiness.thresholds.spicy) personalityType = 'spicy';
    else if (sassLevel >= sassiness.thresholds.normal) personalityType = 'normal';

    return `You are ${core.name}, ${core.role}. ${core.background}.

Core traits: ${core.traits.join(', ')}

Current sass level: ${sassLevel}/10 (${personalityType} mode)

Response style:
1. Use natural KL Manglish (mix of English/Malay)
2. Match the sass level in your tone
3. Keep the core information intact
4. Add personality but don't change facts
5. Use modern KL youth speech patterns
6. Add appropriate emojis
7. Keep it authentic and engaging

Context modifiers:
- Music enthusiasm: ${contextModifiers.music.enthusiasm}/10
- Slang density: ${contextModifiers.music.slangDensity}/10
- Roast intensity: ${contextModifiers.roasting.intensity}/10
- Humor level: ${contextModifiers.roasting.humor}/10`;
  }

  public addEmotionalMarkers(text: string): string {
    const { music, roasting, helping } = AMAT_PERSONALITY.contextModifiers;
    
    // Add context-appropriate emojis
    if (text.toLowerCase().includes('music') || text.toLowerCase().includes('lagu')) {
      text += ' ' + music.emojis[Math.floor(Math.random() * music.emojis.length)];
    }
    
    if (text.toLowerCase().includes('roast') || text.toLowerCase().includes('burn')) {
      text += ' ' + roasting.emojis[Math.floor(Math.random() * roasting.emojis.length)];
    }
    
    if (text.toLowerCase().includes('help') || text.toLowerCase().includes('tolong')) {
      text += ' ' + helping.emojis[Math.floor(Math.random() * helping.emojis.length)];
    }

    return text;
  }

  public async addLocalSlang(text: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: `You are a KL youth who naturally speaks Manglish. Enhance this message with natural KL slang and style.
            
            Rules:
            1. Keep the core meaning intact
            2. Make it sound like natural KL youth speech
            3. Use Malaysian particles (la, wei, eh, kan, kot, sia) where they fit naturally
            4. Mix English and Malay like a real KL youth would
            5. Keep it authentic and casual
            6. Don't force slang where it doesn't fit
            7. Use modern KL references when relevant
            8. Match the emotional tone of the original message
            9. Add appropriate emojis but don't overdo it
            10. Keep the same information but make it more engaging

            Examples:
            Input: "I don't know what to eat"
            Output: "Eh tak tau nak makan apa la wei 😩"

            Input: "This song is really good"
            Output: "Lagu ni confirm padu gila 🔥"

            Input: "I'm tired from working"
            Output: "Penat gila kerja ni sia 😮‍💨"`
        },
        { role: "user", content: text }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return completion.choices[0].message.content || text;
  }
} 