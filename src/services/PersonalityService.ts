import { AmatPersonality, getPersonalityTrait, getSpeechPattern, getEmotionalState, getKnowledgeBase } from '../config/bot-personality';
import { BotPersonality, EmotionalState, KnowledgeBase } from '../types';

export class PersonalityService {
  private personalityConfig: BotPersonality;
  private currentState: Map<string, EmotionalState> = new Map();
  private lastInteraction: Map<string, number> = new Map();

  constructor() {
    this.personalityConfig = AmatPersonality;
  }

  // Public getter for personality info
  public getPersonalityInfo(): { bio: string; role: string; name: string } {
    return {
      bio: this.personalityConfig.bio,
      role: this.personalityConfig.role,
      name: this.personalityConfig.name
    };
  }

  // Public method to get personality traits
  public getPersonalityTrait(trait: keyof BotPersonality['traits']['base']): number {
    return this.personalityConfig.traits.base[trait];
  }

  // Get current emotional state for a group
  public getGroupState(groupId: string): EmotionalState {
    return this.currentState.get(groupId) || {
      state: 'default',
      config: this.personalityConfig.emotions.default
    };
  }

  // Update emotional state based on message content
  public updateEmotionalState(groupId: string, messageContent: string): void {
    const triggers = messageContent.toLowerCase().split(' ');
    const newState = getEmotionalState(triggers);
    this.currentState.set(groupId, newState);
    this.lastInteraction.set(groupId, Date.now());
  }

  // Get appropriate response style based on context
  public getResponseStyle(groupId: string, context: string = 'casual'): {
    tone: number;
    energy: number;
    patterns: string[];
  } {
    const state = this.getGroupState(groupId);
    const baseTraits = this.personalityConfig.traits.base;
    
    return {
      tone: baseTraits.formality * (1 - state.config.expressiveness),
      energy: state.config.energy,
      patterns: getSpeechPattern(context)
    };
  }

  // Get appropriate greeting based on time and context
  public getGreeting(hour: number, context: string = 'casual'): string {
    let timeContext = 'casual';
    if (hour >= 5 && hour < 12) timeContext = 'morning';
    else if (hour >= 12 && hour < 17) timeContext = 'afternoon';
    else if (hour >= 17 && hour < 21) timeContext = 'evening';
    else timeContext = 'night';

    const greetings = this.personalityConfig.speech.greetings[timeContext] || 
                     this.personalityConfig.speech.greetings.casual;
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Get response starter based on emotional context
  public getResponseStarter(emotion: string): string {
    const starters = this.personalityConfig.speech.responseStarters[emotion] || 
                    this.personalityConfig.speech.responseStarters.casual;
    
    return starters[Math.floor(Math.random() * starters.length)];
  }

  // Add personality-appropriate particles to text
  public addPersonalityParticles(text: string, emotion: string = 'default'): string {
    const state = this.personalityConfig.emotions.states[emotion] || this.personalityConfig.emotions.default;
    const particles = this.personalityConfig.speech.particles;
    
    // Add particles based on emotional state
    if (state.expressiveness > 0.7) {
      // Add more particles for high expressiveness
      const emphasisParticles = particles.emphasis[Math.floor(Math.random() * particles.emphasis.length)];
      const excitementParticles = particles.excitement[Math.floor(Math.random() * particles.excitement.length)];
      return `${text} ${emphasisParticles} ${excitementParticles}`;
    } else if (state.expressiveness > 0.4) {
      // Add moderate particles
      const particle = particles.emphasis[Math.floor(Math.random() * particles.emphasis.length)];
      return `${text} ${particle}`;
    }
    
    return text;
  }

  // Check if bot should respond to random message
  public shouldRespondToRandom(groupId: string): boolean {
    const lastTime = this.lastInteraction.get(groupId) || 0;
    const timeSinceLastInteraction = Date.now() - lastTime;
    
    // Increase chance of response if chat has been inactive
    if (timeSinceLastInteraction > this.personalityConfig.behavior.engagement.inactivityThreshold) {
      return Math.random() < this.personalityConfig.behavior.engagement.randomResponseChance * 2;
    }
    
    return Math.random() < this.personalityConfig.behavior.engagement.randomResponseChance;
  }

  // Get topic expertise level
  public getTopicExpertise(topic: string): number {
    const knowledge = getKnowledgeBase(topic);
    if (!knowledge) return 0;
    
    if (knowledge.expertise) return 1.0;
    if (knowledge.interest) return 0.7;
    return 0.3;
  }

  // Get moderation style based on context
  public getModerationStyle(severity: 'low' | 'medium' | 'high'): {
    style: string;
    tone: number;
    useEmojis: boolean;
  } {
    const baseStyle = this.personalityConfig.behavior.moderation.warningStyle;
    
    return {
      style: baseStyle,
      tone: severity === 'high' ? 0.8 : 0.4, // More formal for serious issues
      useEmojis: severity !== 'high'
    };
  }

  // Get random catchphrase
  public getCatchPhrase(): string {
    const phrases = this.personalityConfig.speech.catchPhrases;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // Reset group state
  public resetGroupState(groupId: string): void {
    this.currentState.delete(groupId);
    this.lastInteraction.delete(groupId);
  }
} 