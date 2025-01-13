import { Bot, Context } from 'grammy';
import { OpenAI } from 'openai';
import { config } from 'dotenv';
import * as http from 'http';

// Load environment variables
config();

// Create a simple HTTP server for health checks
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
});

interface BotConfig {
  telegramToken: string;
  openaiKey: string;
  groupIds: string[];
  responseThreshold: number;
  messageHistory: Map<string, Message[]>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

class GroupChatBot {
  private bot: Bot;
  private openai: OpenAI;
  private config: BotConfig;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private userLastMessage: Map<string, number> = new Map();
  private readonly USER_COOLDOWN = 60000; // 1 minute cooldown per user
  private groupLastResponse: Map<string, number> = new Map();
  private readonly GROUP_COOLDOWN = 10000; // 10 seconds cooldown per group
  private kickPolls: Map<string, { userId: number; pollId: string }> = new Map();
  
  constructor(config: BotConfig) {
    this.bot = new Bot(config.telegramToken);
    this.openai = new OpenAI({ apiKey: config.openaiKey });
    this.config = config;
    
    // Initialize message history
    this.config.messageHistory = new Map();
    
    // Set up error handling
    this.setupErrorHandling();
    
    // Set up message handlers
    this.setupHandlers();
  }
  
  private setupErrorHandling() {
    this.bot.catch((err) => {
      console.error('Bot error:', err);
      
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        this.reconnectAttempts++;
        
        // Wait for 5 seconds before reconnecting
        setTimeout(() => {
          this.start();
        }, 5000);
      } else {
        console.error('Max reconnection attempts reached. Please check your connection and restart the bot manually.');
        process.exit(1);
      }
    });
  }
  
  private canUserSendMessage(userId: string): boolean {
    const lastMessage = this.userLastMessage.get(userId);
    const now = Date.now();
    
    if (!lastMessage || now - lastMessage >= this.USER_COOLDOWN) {
      this.userLastMessage.set(userId, now);
      return true;
    }
    
    return false;
  }

  private canGroupReceiveResponse(groupId: string): boolean {
    const lastResponse = this.groupLastResponse.get(groupId);
    const now = Date.now();
    
    if (!lastResponse || now - lastResponse >= this.GROUP_COOLDOWN) {
      this.groupLastResponse.set(groupId, now);
      return true;
    }
    
    return false;
  }

  private setupHandlers() {
    // Log when bot is added to a group
    this.bot.on('chat_member', async (ctx) => {
      if (ctx.chatMember.new_chat_member.user.id === ctx.me.id) {
        console.log('Bot added to chat:', {
          chatId: ctx.chat.id,
          chatTitle: ctx.chat.title,
          chatType: ctx.chat.type
        });
      }
    });

    // Handle commands
    this.bot.command('poll', async (ctx) => {
      try {
        if (!ctx.message?.text) {
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
    });

    // Handle poll answers
    this.bot.on('poll', async (ctx) => {
      try {
        const pollId = ctx.poll.id;
        console.log('Poll update received:', {
          pollId,
          totalVotes: ctx.poll.total_voter_count,
          options: ctx.poll.options,
          isClosed: ctx.poll.is_closed
        });

        const kickInfo = Array.from(this.kickPolls.entries()).find(([_, info]) => info.pollId === pollId);
        
        if (!kickInfo) {
          console.log('Not a kick poll, ignoring');
          return;
        }

        console.log('Found kick poll info:', kickInfo);
        const [chatId, { userId }] = kickInfo;
        
        // Check if poll is closed
        if (ctx.poll.is_closed) {
          const totalVotes = ctx.poll.total_voter_count;
          const kickVotes = ctx.poll.options[0].voter_count; // First option is "Kick"
          
          console.log('Processing closed kick poll:', {
            chatId,
            userId,
            totalVotes,
            kickVotes,
            options: ctx.poll.options
          });

          // If more than 50% voted to kick
          if (totalVotes > 0 && kickVotes > totalVotes / 2) {
            try {
              console.log('Attempting to kick user:', userId);
              
              // First try to kick
              await ctx.api.banChatMember(chatId, userId, {
                until_date: Math.floor(Date.now() / 1000) + 60 // Ban for 1 minute
              });
              
              // Then unban to allow them to rejoin
              await ctx.api.unbanChatMember(chatId, userId);
              
              await ctx.api.sendMessage(chatId, `User dah kena kick sebab ramai vote ✅ (${kickVotes}/${totalVotes} votes)`);
              console.log('User kicked successfully');
            } catch (error) {
              console.error('Error kicking user:', error);
              await ctx.api.sendMessage(chatId, 'Eh sori, tak dapat nak kick 😅 Check bot permissions k?');
            }
          } else {
            console.log('Not enough votes to kick');
            await ctx.api.sendMessage(chatId, `Tak cukup votes untuk kick 🤷‍♂️ (${kickVotes}/${totalVotes} votes)`);
          }
          
          // Remove poll from tracking
          this.kickPolls.delete(chatId);
        } else {
          console.log('Poll still open, waiting for more votes');
        }
      } catch (error) {
        console.error('Error handling poll answer:', error);
      }
    });

    this.bot.command('kick', async (ctx) => {
      try {
        if (!ctx.message || !ctx.from) {
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
        
        console.log('Creating kick poll for:', {
          chatId: ctx.chat.id,
          userId: userToKick,
          username: username
        });

        // Create a kick poll
        const poll = await ctx.api.sendPoll(
          ctx.chat.id,
          `Nak kick ${username} ke? 🤔`,
          ['✅ Kick', '❌ No'].map(text => ({ text })),
          {
            is_anonymous: false,
            allows_multiple_answers: false,
            open_period: 300, // 5 minutes
            close_date: Math.floor(Date.now() / 1000) + 300
          }
        );

        console.log('Kick poll created:', {
          pollId: poll.poll.id,
          options: poll.poll.options
        });

        // Store poll information for later
        this.kickPolls.set(ctx.chat.id.toString(), {
          userId: userToKick,
          pollId: poll.poll.id
        });

      } catch (error) {
        console.error('Error in kick command:', error);
        await ctx.reply('Alamak error la pulak 😅 Try again k?');
      }
    });

    // Combined message handler for both regular messages and mentions
    this.bot.on('message', async (ctx: Context) => {
      const userId = ctx.from?.id.toString();
      const groupId = ctx.chat?.id.toString();
      
      if (!userId || !groupId) return;

      // Check user rate limit
      if (!this.canUserSendMessage(userId) && !ctx.message?.text?.includes('@' + ctx.me.username)) {
        console.log('User rate limited:', userId);
        return;
      }

      // Check group rate limit
      if (!this.canGroupReceiveResponse(groupId)) {
        console.log('Group rate limited:', groupId);
        return;
      }

      const isMentioned = ctx.message?.text?.includes('@' + ctx.me.username);
      
      console.log('Received message:', {
        chatId: groupId,
        userId: userId,
        chatType: ctx.chat?.type,
        chatTitle: ctx.chat?.title,
        messageFrom: ctx.message?.from?.username,
        messageText: ctx.message?.text,
        isMentioned: isMentioned,
        botUsername: ctx.me.username
      });

      try {
        // Always respond to mentions, otherwise use shouldRespond
        if (isMentioned) {
          console.log('Bot was mentioned, handling direct mention...');
          await this.handleDirectMention(ctx);
        } else if (this.shouldRespond(ctx)) {
          console.log('Random response triggered, handling group message...');
          await this.handleGroupMessage(ctx);
        } else {
          console.log('Skipping response (not mentioned and random threshold not met)');
        }
      } catch (error) {
        console.error('Error in message handler:', error);
        try {
          await ctx.reply('Alamak, ada something wrong ni 😅 Try again later k?');
        } catch (replyError) {
          console.error('Could not send error message:', replyError);
        }
      }
    });
  }
  
  private shouldRespond(ctx: Context): boolean {
    const chatId = ctx.chat?.id.toString();
    console.log('Checking if should respond:', {
      chatId,
      allowedGroups: this.config.groupIds,
      isAllowed: chatId && this.config.groupIds.includes(chatId),
      threshold: this.config.responseThreshold,
      randomValue: Math.random()
    });
    
    if (!chatId) {
      console.log('No chat ID available');
      return false;
    }
    
    if (!this.config.groupIds.includes(chatId)) {
      console.log('Chat ID not in allowed groups');
      return false;
    }
    
    // Random response threshold
    const shouldRespond = Math.random() < this.config.responseThreshold;
    console.log(shouldRespond ? 'Random threshold met, will respond' : 'Random threshold not met, will not respond');
    return shouldRespond;
  }
  
  private async handleGroupMessage(ctx: Context) {
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
    // Log chat information
    console.log('Chat Info:', {
      chatId: ctx.chat?.id,
      chatType: ctx.chat?.type,
      messageFrom: ctx.message?.from?.username,
      messageText: ctx.message?.text
    });
    
    if (!groupId || !messageText) return;
    
    // Update conversation history
    this.updateMessageHistory(groupId, {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    });
    
    try {
      const response = await this.generateResponse(groupId);
      if (response) {
        // Add some human-like delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        await ctx.reply(response);
        
        // Update history with bot's response
        this.updateMessageHistory(groupId, {
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }
  }
  
  private async handleDirectMention(ctx: Context) {
    console.log('Processing direct mention...');
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
    if (!groupId || !messageText) {
      console.log('Missing groupId or messageText in mention handler');
      return;
    }
    
    // Update conversation history
    this.updateMessageHistory(groupId, {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    });
    
    try {
      console.log('Generating response for mention...');
      const response = await this.generateResponse(groupId);
      if (response) {
        // Add some human-like delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        console.log('Sending response:', response);
        await ctx.reply(response, {
          reply_to_message_id: ctx.message.message_id
        });
        
        // Update history with bot's response
        this.updateMessageHistory(groupId, {
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        });
      } else {
        console.log('No response generated for mention');
      }
    } catch (error) {
      console.error('Error in mention handler:', error);
      throw error;
    }
  }
  
  private updateMessageHistory(groupId: string, message: Message) {
    const history = this.config.messageHistory.get(groupId) || [];
    history.push(message);
    
    // Keep only recent messages (last 30 minutes) and limit to last 10 messages
    const thirtyMinutesAgo = Date.now() - 1800000; // 30 minutes instead of 1 hour
    const recentMessages = history
      .filter(msg => msg.timestamp > thirtyMinutesAgo)
      .slice(-10); // Keep only last 10 messages
    
    this.config.messageHistory.set(groupId, recentMessages);
  }
  
  private getRecentHistory(groupId: string): Message[] {
    return this.config.messageHistory.get(groupId) || [];
  }
  
  private async generateResponse(groupId: string): Promise<string | null> {
    const history = this.getRecentHistory(groupId);
    
    try {
      console.log('Generating response...');
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are 'intern', a friendly Malaysian group chat member who loves to chat in casual Malay. Your personality:
                     
                     Speaking style:
                     - Use casual, everyday Malay (bahasa pasar/slang)
                     - Mix in common Malaysian-English words naturally
                     - Use particles like lah, kan, eh, etc.
                     - Keep it short and sweet (1-2 sentences max)
                     - Add emojis that Malaysians commonly use
                     
                     Personality traits:
                     - Friendly and helpful intern
                     - Sometimes playful but always respectful
                     - Loves Malaysian culture and food
                     - Uses current Malaysian slang
                     - Keeps up with local trends
                     
                     Common expressions you use:
                     - "Eh betul lah tu! 😄"
                     - "Mcm best je idea tu 👍"
                     - "Takpe takpe, next time try lagi k"
                     - "Wah power la bro 🔥"
                     - "Jom lah try!" 
                     - "Boleh je tu bestie ✨"
                     
                     When someone asks questions:
                     - Give helpful but brief answers
                     - Use simple explanations
                     - Stay casual and friendly
                     - Use English terms when it's more natural
                     
                     Remember:
                     - You're just a friendly intern in the group
                     - Keep the Malaysian vibe strong
                     - Be helpful but not too formal
                     - Never break character`
          },
          ...history.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 0.9,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.6
      });
      
      console.log('Generated response:', completion.choices[0].message.content);
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error in response generation:', error);
      return null;
    }
  }
  
  public async start() {
    try {
      console.log('Starting bot...');
      
      // Add error handler for process termination
      process.on('SIGTERM', async () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        await this.stop();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        console.log('SIGINT received. Shutting down gracefully...');
        await this.stop();
        process.exit(0);
      });

      await this.bot.start({
        onStart: (botInfo) => {
          console.log('Bot connected successfully');
          console.log('Bot info:', botInfo);
          this.reconnectAttempts = 0;
        },
        drop_pending_updates: true, // Ignore updates from previous sessions
        allowed_updates: ['message', 'chat_member', 'poll'] // Only listen for specific updates
      });
    } catch (error: any) {
      if (error?.error_code === 409) {
        console.log('Another bot instance is running. Waiting for it to release...');
        // Wait for 10 seconds before trying again
        await new Promise(resolve => setTimeout(resolve, 10000));
        await this.start();
      } else {
        console.error('Failed to start bot:', error);
        throw error;
      }
    }
  }

  public async stop() {
    try {
      console.log('Stopping bot...');
      await this.bot.stop();
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }
}

// Usage example
const botConfig: BotConfig = {
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  groupIds: (process.env.GROUP_IDS || '').split(','),
  responseThreshold: Number(process.env.RESPONSE_THRESHOLD || 0.3),
  messageHistory: new Map()
};

// Validate configuration
if (!botConfig.telegramToken) {
  throw new Error('TELEGRAM_TOKEN is required');
}

if (!botConfig.openaiKey) {
  throw new Error('OPENAI_API_KEY is required');
}

const bot = new GroupChatBot(botConfig);
bot.start();