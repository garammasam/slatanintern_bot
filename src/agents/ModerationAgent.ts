import { Context } from 'grammy';
import { IModerationAgent, ICoreAgent, PollInfo } from '../types';

export class ModerationAgent implements IModerationAgent {
  private coreAgent: ICoreAgent;
  private kickPolls: Map<string, PollInfo> = new Map();
  private readonly BANNED_WORDS: string[] = [
    // Add banned words/patterns here
  ];

  constructor(coreAgent: ICoreAgent) {
    console.log('👮 ModerationAgent: Initializing...');
    this.coreAgent = coreAgent;
  }

  public async initialize(): Promise<void> {
    console.log('👮 ModerationAgent: Setting up moderation handlers...');
    const bot = this.coreAgent.getBot();
    
    // Handle kick command
    bot.command('kick', async (ctx: Context) => {
      await this.handleKickCommand(ctx);
    });

    // Handle regular poll command
    bot.command('poll', async (ctx: Context) => {
      await this.handlePollCommand(ctx);
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
      return true;
    }

    // Add more moderation checks here as needed
    
    console.log('👮 ModerationAgent: Message passed moderation checks');
    return false;
  }

  private async handlePollCommand(ctx: Context): Promise<void> {
    try {
      if (!ctx.message?.text || !ctx.chat) {
        await ctx.reply('Eh bestie, tulis soalan poll sekali k? Contoh: /poll Nak makan apa?');
        return;
      }

      const question = ctx.message.text.split('/poll ')[1];
      if (!question) {
        await ctx.reply('Eh bestie, tulis soalan poll sekali k? Contoh: /poll Nak makan apa?');
        return;
      }

      await ctx.api.sendPoll(
        ctx.chat.id,
        question,
        ['👍 Yes', '👎 No', '🤔 Maybe'].map(text => ({ text })),
        {
          is_anonymous: false,
          allows_multiple_answers: false
        }
      );
    } catch (error) {
      console.error('Error creating poll:', error);
      await ctx.reply('Alamak error la pulak 😅 Try again k?');
    }
  }

  public async handleKickCommand(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !ctx.from || !ctx.chat) {
        await ctx.reply('Alamak error la pulak 😅 Try again k?');
        return;
      }

      // Check if the bot has admin rights
      const botMember = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);
      if (!botMember || !['administrator', 'creator'].includes(botMember.status)) {
        await ctx.reply('Eh sori, aku kena jadi admin dulu baru boleh kick orang 😅');
        return;
      }

      // Check if the command issuer is an admin
      const sender = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
      if (!['administrator', 'creator'].includes(sender.status)) {
        await ctx.reply('Eh sori bestie, admin je boleh guna command ni 🙏');
        return;
      }

      // Get the user to kick
      const replyToMessage = ctx.message.reply_to_message;
      if (!replyToMessage?.from) {
        await ctx.reply('Reply kat message orang yang nak kena kick tu k?');
        return;
      }

      const userToKick = replyToMessage.from.id;
      
      // Check if trying to kick an admin
      const targetMember = await ctx.api.getChatMember(ctx.chat.id, userToKick);
      if (['administrator', 'creator'].includes(targetMember.status)) {
        await ctx.reply('Eh tak boleh kick admin la bestie 😅');
        return;
      }

      // Check if trying to kick the bot
      if (userToKick === ctx.me.id) {
        await ctx.reply('Eh jangan kick aku la bestie 🥺');
        return;
      }

      const username = replyToMessage.from.username || replyToMessage.from.first_name || 'user';
      
      // Create and handle the kick poll
      await this.createKickPoll(ctx, userToKick, username);

    } catch (error) {
      console.error('Error in kick command:', error);
      await ctx.reply('Alamak error la pulak 😅 Try again k?');
    }
  }

  public async createKickPoll(ctx: Context, userToKick: number, username: string): Promise<any> {
    if (!ctx.chat) {
      console.error('Chat context is undefined');
      return;
    }

    const poll = await ctx.api.sendPoll(
      ctx.chat.id,
      `Should we kick ${username}? Vote now! 🤔`,
      ['✅ Kick them out fr fr', '❌ Nah we good'].map(text => ({ text })),
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

    this.kickPolls.set(ctx.chat.id.toString(), pollInfo);
    
    return poll;
  }

  public async processPollResults(ctx: Context, messageId: number, userToKick: number): Promise<void> {
    if (!ctx.chat) {
      console.error('Chat context is undefined');
      return;
    }

    try {
      console.log('Processing poll results for message:', messageId);
      const message = await ctx.api.stopPoll(ctx.chat.id, messageId);
      
      const totalVotes = message.total_voter_count;
      const kickVotes = message.options[0].voter_count;

      if (totalVotes > 0 && kickVotes > totalVotes / 2) {
        try {
          await ctx.api.banChatMember(ctx.chat.id, userToKick, {
            until_date: Math.floor(Date.now() / 1000) + 60
          });
          await ctx.api.unbanChatMember(ctx.chat.id, userToKick);
          await ctx.api.sendMessage(ctx.chat.id, `User dah kena kick sebab ramai vote ✅ (${kickVotes}/${totalVotes} votes)`);
        } catch (error) {
          console.error('Error executing kick:', error);
          await ctx.api.sendMessage(ctx.chat.id, 'Eh sori, tak dapat nak kick 😅 Check bot permissions k?');
        }
      } else {
        await ctx.api.sendMessage(ctx.chat.id, `Tak cukup votes untuk kick 🤷‍♂️ (${kickVotes}/${totalVotes} votes)`);
      }
    } catch (error) {
      console.error('Error processing poll results:', error);
    } finally {
      // Clean up poll data
      const pollInfo = this.kickPolls.get(ctx.chat.id.toString()) as PollInfo;
      if (pollInfo?.timer) {
        clearTimeout(pollInfo.timer);
      }
      this.kickPolls.delete(ctx.chat.id.toString());
    }
  }

  private async handlePollUpdate(ctx: Context): Promise<void> {
    try {
      if (!ctx.poll) {
        console.log('👮 ModerationAgent: No poll data received');
        return;
      }

      const pollId = ctx.poll.id;
      console.log('👮 ModerationAgent: Poll update received:', {
        pollId,
        totalVotes: ctx.poll.total_voter_count,
        options: ctx.poll.options,
        isClosed: ctx.poll.is_closed
      });

      const kickInfo = Array.from(this.kickPolls.entries()).find(([_, info]) => info.pollId === pollId);
      
      if (!kickInfo) {
        console.log('👮 ModerationAgent: Not a kick poll, ignoring');
        return;
      }

      console.log('👮 ModerationAgent: Found kick poll info:', kickInfo);
      const [_, pollInfo] = kickInfo;
      
      // If poll is closed or has enough votes to kick
      if (ctx.poll.is_closed || (ctx.poll.total_voter_count > 0 && ctx.poll.options[0].voter_count > ctx.poll.total_voter_count / 2)) {
        await this.processPollResults(ctx, pollInfo.messageId, pollInfo.userId);
      }
    } catch (error) {
      console.error('👮 ModerationAgent: Error in poll handler:', error);
    }
  }
} 