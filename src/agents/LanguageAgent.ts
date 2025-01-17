import { ILanguageAgent } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class LanguageAgent implements ILanguageAgent {
  private personalityService: PersonalityService;
  private readonly slangMap: { [key: string]: string[] } = {
    'hello': ['yo', 'wassup', 'oi', 'wei', 'eh', 'weh'],
    'yes': ['ya', 'betul', 'confirm', 'legit', 'fr', 'fr fr'],
    'no': ['tak', 'takde', 'xde', 'cap', 'nah'],
    'good': ['best', 'gempak', 'power', 'lit', 'fire', 'valid'],
    'bad': ['teruk', 'fail', 'dead', 'L', 'mid'],
    'very': ['gila', 'sangat', 'super', 'crazy', 'mad'],
    'friend': ['bro', 'brader', 'gang', 'fam', 'bestie', 'goat'],
    'amazing': ['sheesh', 'bussin', 'insane', 'wild', 'mental'],
    'excited': ['hype', 'gassed', 'buzzin', 'cant wait', 'lesgo'],
    'true': ['facts', 'no cap', 'real', 'frfr', 'ong'],
    'cool': ['swag', 'dope', 'clean', 'fresh', 'hard']
  };

  constructor() {
    console.log('🗣️ LanguageAgent: Initializing...');
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    // Initialization logic if needed
  }

  public async shutdown(): Promise<void> {
    // Cleanup logic if needed
  }

  public async enhanceResponse(response: string, groupId: string): Promise<string> {
    // Get personality-based emotional state from context
    const emotion = this.personalityService.getPersonalityTrait('enthusiasm') > 0.7 ? 'hype' : 'chill';
    
    // Add personality particles based on emotion
    let enhancedText = this.personalityService.addPersonalityParticles(response, emotion);
    
    // Replace formal words with slang based on personality traits
    enhancedText = this.replaceWithSlang(enhancedText);
    
    // Add catchphrase if appropriate
    if (Math.random() < 0.2) { // 20% chance
      enhancedText = `${this.personalityService.getCatchPhrase()} ${enhancedText}`;
    }
    
    // Add emojis based on personality and context
    return Promise.resolve(this.addEmojis(enhancedText, emotion));
  }

  private replaceWithSlang(text: string): string {
    let enhancedText = text;
    
    // Get current personality traits to influence slang usage
    const friendliness = this.personalityService.getPersonalityTrait('friendliness');
    const formality = this.personalityService.getPersonalityTrait('formality');
    
    // Adjust slang probability based on personality traits
    const slangProbability = Math.min(0.8, Math.max(0.2, 
      (friendliness * 0.6 + (1 - formality) * 0.4)
    ));

    Object.entries(this.slangMap).forEach(([formal, slangOptions]) => {
      const regex = new RegExp(`\\b${formal}\\b`, 'gi');
      enhancedText = enhancedText.replace(regex, (match) => {
        // Use personality traits to determine if we should replace with slang
        if (Math.random() < slangProbability) {
          const slangIndex = Math.floor(Math.random() * slangOptions.length);
          return slangOptions[slangIndex];
        }
        return match;
      });
    });

    return enhancedText;
  }

  public async getSlangResponse(message: string): Promise<string | null> {
    try {
      // Get personality-influenced response
      const enhancedResponse = await this.enhanceResponse(message, 'default');
      
      // Return null if we couldn't enhance the response
      if (!enhancedResponse) {
        return null;
      }

      return enhancedResponse;
    } catch (error) {
      console.error('Error getting slang response:', error);
      return null;
    }
  }

  private addEmojis(text: string, context: string): string {
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    const emojiMap: { [key: string]: string[] } = {
      'hype': ['🔥', '💯', '⚡', '🚀', '💪'],
      'chill': ['😎', '✨', '💫', '🌟', '👌'],
      'gaming': ['🎮', '🕹️', '🎯', '🏆', '⭐'],
      'music': ['🎵', '🎶', '🎸', '🎹', '🎧'],
      'food': ['🍜', '🍖', '🍗', '🍚', '🥘']
    };

    // Select emojis based on context and enthusiasm
    const contextEmojis = emojiMap[context] || emojiMap['hype'];
    const emojiCount = Math.floor(enthusiasm * 3); // 0-3 emojis based on enthusiasm

    let enhancedText = text;
    for (let i = 0; i < emojiCount; i++) {
      const randomEmoji = contextEmojis[Math.floor(Math.random() * contextEmojis.length)];
      // Add emoji at start or end based on position
      if (i % 2 === 0) {
        enhancedText = `${randomEmoji} ${enhancedText}`;
      } else {
        enhancedText = `${enhancedText} ${randomEmoji}`;
      }
    }

    return enhancedText;
  }

  public async enrichSlangContext(message: string): Promise<string[]> {
    // Extract potential slang words based on our slang map
    const slangWords: string[] = [];
    
    Object.entries(this.slangMap).forEach(([formal, slangs]) => {
      slangs.forEach(slang => {
        if (message.toLowerCase().includes(slang.toLowerCase())) {
          slangWords.push(slang);
        }
      });
    });

    return slangWords;
  }

  public async addLocalSlang(text: string): Promise<string> {
    // Use our existing replaceWithSlang method
    const slangText = this.replaceWithSlang(text);
    
    // Add personality-based particles
    const emotion = this.personalityService.getPersonalityTrait('enthusiasm') > 0.7 ? 'hype' : 'chill';
    return this.personalityService.addPersonalityParticles(slangText, emotion);
  }

  public addEmotionalMarkers(text: string): string {
    // Use our existing addEmojis method with emotion based on personality
    const emotion = this.personalityService.getPersonalityTrait('enthusiasm') > 0.7 ? 'hype' : 'chill';
    return this.addEmojis(text, emotion);
  }
} 