import { Context } from 'grammy';
import { IModerationAgent, ICoreAgent, PollInfo } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class ModerationAgent implements IModerationAgent {
  private coreAgent: ICoreAgent;
  private personalityService: PersonalityService;
  private kickPolls: Map<string, PollInfo> = new Map();
  private readonly BANNED_WORDS: string[] = [
    // Add banned words/patterns here
  ];

  constructor(coreAgent: ICoreAgent) {
    console.log('👮 ModerationAgent: Initializing...');
    this.coreAgent = coreAgent;
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    console.log('👮 ModerationAgent: Setting up moderation handlers...');
    const bot = this.coreAgent.getBot();
    
    // Handle kick command
    bot.command('kick', async (ctx: Context) => {
      await this.handleKickCommand(ctx);
    });

    // Handle poll answers
    bot.on('poll', async (ctx: Context) => {
      await this.handlePollUpdate(ctx);
    });

    console.log('👮 ModerationAgent: Initialization complete');
  }

  public async shutdown(): Promise<void> {
    console.log('👮 ModerationAgent: Shutting down');
    this.kickPolls.clear();
  }

  public async shouldModerateMessage(ctx: Context): Promise<boolean> {
    console.log('👮 ModerationAgent: Checking message for moderation');
    
    const messageText = ctx.message?.text;
    if (!messageText) return false;

    // Check for banned words/patterns
    const containsBannedWord = this.BANNED_WORDS.some(word => 
      messageText.toLowerCase().includes(word.toLowerCase())
    );

    if (containsBannedWord) {
      console.log('👮 ModerationAgent: Message contains banned content');
      await ctx.deleteMessage().catch(err => 
        console.error('👮 ModerationAgent: Failed to delete message:', err)
      );

      // Get moderation style based on severity and personality
      const moderationStyle = this.personalityService.getModerationStyle('high');
      const warningMessage = this.formatWarningMessage(messageText, moderationStyle);
      
      await ctx.reply(warningMessage, {
        reply_to_message_id: ctx.message?.message_id
      });

      return true;
    }

    return false;
  }

  private formatWarningMessage(messageText: string, moderationStyle: any): string {
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    const sassiness = this.personalityService.getPersonalityTrait('sassiness');
    
    let baseMessage = '';
    
    if (sassiness > 0.7) {
      baseMessage = "Bro really thought that was it? L behavior detected! Keep that energy out of here! 💀";
    } else if (enthusiasm > 0.7) {
      baseMessage = "NAH FR FR what was that? Delete that L take rn! 🚫";
    } else {
      baseMessage = "Common L detected. Keep the chat clean or catch this ratio! 🗑️";
    }

    // Add personality particles
    return this.personalityService.addPersonalityParticles(baseMessage, 'roast');
  }

  public async handleKickCommand(ctx: Context): Promise<void> {
    if (!ctx.message?.reply_to_message?.from?.id || !ctx.from || !ctx.chat) {
      const response = this.personalityService.addPersonalityParticles(
        "Skill issue fr fr! Reply to someone's message to kick them! 🤦‍♂️", 
        'roast'
      );
      await ctx.reply(response);
      return;
    }

    const userToKick = ctx.message.reply_to_message.from.id;
    const username = ctx.message.reply_to_message.from.username || 'this bozo';

    // Check if user has permission to kick
    const chatMember = await ctx.getChatMember(ctx.from.id);
    if (!['creator', 'administrator'].includes(chatMember.status)) {
      const response = this.personalityService.addPersonalityParticles(
        "Imagine trying to kick without admin perms! Common L! 💀", 
        'roast'
      );
      await ctx.reply(response);
      return;
    }

    // Create kick poll
    await this.createKickPoll(ctx, userToKick, username);
  }

  public async createKickPoll(ctx: Context, userToKick: number, username: string): Promise<any> {
    if (!ctx.chat) {
      console.error('Chat context is undefined');
      return;
    }

    const moderationStyle = this.personalityService.getModerationStyle('high');
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    
    // Create poll with personality-influenced options
    const pollQuestion = enthusiasm > 0.7 
      ? `YO SHOULD WE RATIO ${username} OUT OF HERE? 💀`
      : `Time to vote on ${username}'s L behavior?`;

    const pollOptions = enthusiasm > 0.7
      ? [{ text: '✅ PACK WATCH FR FR!' }, { text: '❌ NAH THEY VALID!' }]
      : [{ text: '✅ L + Ratio + Kicked' }, { text: '❌ Let them cook' }];

    const poll = await ctx.api.sendPoll(
      ctx.chat.id,
      pollQuestion,
      pollOptions,
      {
        is_anonymous: false,
        allows_multiple_answers: false,
        open_period: 300 // 5 minutes
      }
    );

    // Store poll information
    const pollInfo: PollInfo = {
      userId: userToKick,
      pollId: poll.poll.id,
      messageId: poll.message_id,
      startTime: Date.now(),
      timer: setTimeout(async () => {
        await this.processPollResults(ctx, poll.message_id, userToKick);
      }, 300000) // 5 minutes
    };

    this.kickPolls.set(poll.poll.id, pollInfo);
  }

  public async processPollResults(ctx: Context, messageId: number, userToKick: number): Promise<void> {
    if (!ctx.chat) {
      console.error('Chat context is undefined');
      return;
    }

    try {
      const poll = await ctx.api.stopPoll(ctx.chat.id, messageId);
      const kickVotes = poll.options[0].voter_count || 0;
      const keepVotes = poll.options[1].voter_count || 0;

      // Get personality traits for response
      const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
      const sassiness = this.personalityService.getPersonalityTrait('sassiness');

      if (kickVotes > keepVotes) {
        // Kick the user
        await ctx.banChatMember(userToKick, {
          until_date: Math.floor(Date.now() / 1000) + 60 // Ban for 1 minute (kick)
        });

        // Send personality-based kick message
        let kickMessage = '';
        if (enthusiasm > 0.7) {
          kickMessage = "RIPBOZO! 👋 REST IN PISS YOU WON'T BE MISSED! 💀";
        } else if (sassiness > 0.7) {
          kickMessage = "Pack watch in effect! Smoking that user pack! 🚬";
        } else {
          kickMessage = "L + Ratio + Kicked + Touch Grass";
        }

        await ctx.reply(this.personalityService.addPersonalityParticles(kickMessage, 'roast'));
      } else {
        // Send personality-based mercy message
        let mercyMessage = '';
        if (enthusiasm > 0.7) {
          mercyMessage = "RARE W FOR THE ACCUSED! You live to take another L! 😮‍💨";
        } else if (sassiness > 0.7) {
          mercyMessage = "Lucky day bozo! Don't make us regret this! 🎯";
        } else {
          mercyMessage = "Group showing mercy fr fr. Better not catch another L! 💀";
        }

        await ctx.reply(this.personalityService.addPersonalityParticles(mercyMessage, 'roast'));
      }

      // Clean up poll info
      this.kickPolls.delete(poll.id);
    } catch (error) {
      console.error('Error processing poll results:', error);
      const errorMsg = this.personalityService.addPersonalityParticles(
        "Skill issue with the poll fr fr! Try again later bozo! 💀", 
        'roast'
      );
      await ctx.reply(errorMsg);
    }
  }

  private async handlePollUpdate(ctx: Context): Promise<void> {
    if (!ctx.poll) return;

    const pollInfo = this.kickPolls.get(ctx.poll.id);
    if (!pollInfo) return;

    // Check if poll has ended
    if (ctx.poll.is_closed) {
      await this.processPollResults(ctx, pollInfo.messageId, pollInfo.userId);
    }
  }
} 