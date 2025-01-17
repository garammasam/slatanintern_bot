import { Context } from 'grammy';
import { IMessageAgent, ICoreAgent, IConversationAgent, IModerationAgent, IInquiryAgent, IDatabaseAgent } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class MessageAgent implements IMessageAgent {
  private coreAgent: ICoreAgent;
  private conversationAgent: IConversationAgent;
  private moderationAgent: IModerationAgent;
  private inquiryAgent: IInquiryAgent;
  private databaseAgent: IDatabaseAgent;
  private personalityService: PersonalityService;

  constructor(
    coreAgent: ICoreAgent,
    conversationAgent: IConversationAgent,
    moderationAgent: IModerationAgent,
    inquiryAgent: IInquiryAgent,
    databaseAgent: IDatabaseAgent
  ) {
    console.log('💬 MessageAgent: Initializing...');
    this.coreAgent = coreAgent;
    this.conversationAgent = conversationAgent;
    this.moderationAgent = moderationAgent;
    this.inquiryAgent = inquiryAgent;
    this.databaseAgent = databaseAgent;
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    // Initialization logic if needed
  }

  public async shutdown(): Promise<void> {
    // Cleanup logic if needed
  }

  public async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const groupId = ctx.chat?.id.toString();
    
    if (!userId || !groupId || !ctx.message?.text) return;

    try {
      // Get personality traits to influence message processing
      const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
      const formality = this.personalityService.getPersonalityTrait('formality');

      // Check moderation first
      const shouldModerate = await this.moderationAgent.shouldModerateMessage(ctx);
      if (shouldModerate) {
        return;
      }

      // Process message based on type
      const messageType = await this.processMessageType(ctx);
      let response: string | null = null;

      switch (messageType) {
        case 'COMMAND':
          // Handle commands through appropriate agents
          break;

        case 'INQUIRY':
          if (this.inquiryAgent.isMerchInquiry(ctx.message.text)) {
            response = this.inquiryAgent.handleMerchInquiry();
          } else if (this.inquiryAgent.isSocialInquiry(ctx.message.text)) {
            response = this.inquiryAgent.handleSocialInquiry();
          } else {
            response = await this.inquiryAgent.handleArtistInquiry(ctx.message.text);
          }
          break;

        case 'GREETING':
          // Generate personality-aware greeting
          response = await this.conversationAgent.generateResponse(groupId);
          break;

        case 'RANDOM':
          // Random engagement with personality
          if (this.personalityService.getPersonalityTrait('enthusiasm') > 0.7) {
            response = await this.conversationAgent.generateResponse(groupId);
          }
          break;

        default:
          // Check if it's a mention or reply to bot
          const isMentioned = ctx.message.text.includes('@' + ctx.me.username);
          const isReplyToBot = ctx.message?.reply_to_message?.from?.id === ctx.me.id;

          if (isMentioned || isReplyToBot) {
            response = await this.conversationAgent.generateResponse(groupId);
          }
      }

      // Send response if we have one
      if (response) {
        await ctx.reply(response, { 
          reply_to_message_id: ctx.message.message_id,
          parse_mode: 'HTML'
        });
      }

    } catch (error) {
      console.error('Error handling message:', error);
      await ctx.reply('Alamak error la pulak. Try again later k? 😅');
    }
  }

  private async processMessageType(ctx: Context): Promise<string> {
    const text = ctx.message?.text?.toLowerCase() || '';
    
    // Get personality traits
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    const formality = this.personalityService.getPersonalityTrait('formality');

    // Check for commands
    if (text.startsWith('/') || text.startsWith('!')) {
      return 'COMMAND';
    }

    // Check for inquiries
    const inquiryPatterns = this.getInquiryPatterns(formality);
    if (inquiryPatterns.some(pattern => text.includes(pattern))) {
      return 'INQUIRY';
    }

    // Check for greetings
    const greetingPatterns = this.getGreetingPatterns(enthusiasm);
    if (greetingPatterns.some(pattern => text.includes(pattern))) {
      return 'GREETING';
    }

    // Random engagement based on personality
    const randomEngagementThreshold = Math.min(0.3, enthusiasm * 0.4);
    if (Math.random() < randomEngagementThreshold) {
      return 'RANDOM';
    }

    return 'NONE';
  }

  private getInquiryPatterns(formality: number): string[] {
    const formalPatterns = [
      'what', 'how', 'when', 'where', 'who', 'which', 'why',
      'can you', 'could you', 'would you', 'tell me'
    ];

    const casualPatterns = [
      'eh', 'wei', 'oi', 'leh', 'sial', 'macam mana', 'bila', 'siapa',
      'mana', 'kenapa', 'camne', 'cemana', 'mcm mana'
    ];

    return formality > 0.5 ? 
      [...formalPatterns, ...casualPatterns.slice(0, 3)] : 
      [...casualPatterns, ...formalPatterns.slice(0, 3)];
  }

  private getGreetingPatterns(enthusiasm: number): string[] {
    const formalGreetings = [
      'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'hey there'
    ];

    const casualGreetings = [
      'yo', 'sup', 'wassup', 'oi', 'wei', 'woi', 'boss', 
      'pagi', 'petang', 'malam', 'hai'
    ];

    const enthusiasticGreetings = enthusiasm > 0.7 ? [
      'lets go', 'lesgo', 'ayy', 'yooo', 'sheesh',
      'wassup gang', 'squad up'
    ] : [];

    return [...formalGreetings, ...casualGreetings, ...enthusiasticGreetings];
  }
} 
  
