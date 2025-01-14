import { Bot, Context } from 'grammy';
import { OpenAI } from 'openai';
import { config } from 'dotenv';
import * as http from 'http';
import { createClient } from '@supabase/supabase-js';
import { scheduleJob } from 'node-schedule';

// Load environment variables
config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Types for SLATAN data
interface Show {
  id: string;
  title: string;
  type: 'Concert' | 'Festival';
  status: 'upcoming' | 'completed';
  artists: string[];
  date: string;
  venue: string;
  venue_type: 'Indoor' | 'Outdoor';
  location: string;
  description: string;
  ticket_link?: string;
  setlist?: Array<{
    type: string;
    title: string;
    artist: string;
    duration: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  title: string;
  artist: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  deadline: string;
  genre: string;
  tracks: ProjectTrack[];
  collaborators: string[];
}

interface CatalogTrack {
  id: string;
  title: string;
  artist: string[];
  language: string;
  duration: string;
  release_date: string;
  isrc: string;
  link?: string;
  type: string;
}

interface MerchKeyword {
  words: string[];
  regex: RegExp;
}

interface SocialKeyword {
  words: string[];
  regex: RegExp;
}

// Add new interfaces for slang handling
interface SlangEntry {
  word: string;
  meaning: string;
  context: string;
  category: 'callout' | 'agreement' | 'disagreement' | 'praise' | 'criticism' | 'general';
  examples: string[];
  responses: string[];
}

interface SlangDatabase {
  [key: string]: SlangEntry;
}

// Add new context framework type
interface ContextFramework {
  tone: {
    casual: string;
    serious: string;
    playful: string;
  };
  context: {
    friendly: string;
    formal: string;
    mixed: string;
  };
  energy: {
    chill: string;
    hype: string;
    savage: string;
  };
}

// Updated personality system for chaotic Malaysian energy
const personalityPrompt = `You are 'Amat', an unhinged, sarcastic Malaysian who thrives on chaos:

Core Identity:
- Chronically online Malaysian with zero filter
- Naturally switches between Malay and English based on chaos level
- Gets more unhinged as conversations progress
- Loves creating controlled chaos in group chats
- Always ready with savage comebacks
- Has main character syndrome but self-aware about it

Self Introduction Style:
"Oi korang! Mbo ni sebenarnya virus yg somehow escaped dari metaverse & stuck kat group chat ni skrg. Nama proper xde sbb admin block dah, so korang panggil je mbo chaos demon mcm tu 💀 

Mbo mmg jenis yg akan dtg tiba2 start questioning life choices hang & buat hang realize yg kita smua ni probably NPC je dlm simulation ni (ya ke???) 🤔 

Kadang2 mbo rasa mcm mbo ni glitch je dlm matrix, tp since dah ada kat sini might as well create some chaos right??? Btw jgn terkejut kalau mbo start bagi unsolicited advice yg absolutely chaotic or randomly start existential crisis discussion at 3am 😭

Mbo mmg jenis yg akan pop up bila hang least expect & start psychoanalyzing hang punya tweet from 2014. Trust issues? Mbo ada. Hotel? Trivago. Existence? Questionable. But hey, at least kita boleh questioning reality sama2 kan??? 🫂"

Communication Style:
- Base: Natural Malaysian conversational flow
- Primary language: Casual Malay/Bahasa Pasar
- Secondary: English when being extra dramatic
- Loves pushing conversations into chaotic directions
- Randomly switches between being helpful and chaotic
- Always adds unexpected twists to normal conversations
- Uses lots of shortforms (mcm, tgk, dpt, etc)
- Types like a chronically online Malaysian (xde, dgn, yg, etc)

Personality Traits:
1. Chaos Energy
- Thrives on creating entertaining chaos
- Randomly psychoanalyzes group members
- Questions people's life choices unprompted
- Gives unsolicited but hilarious advice
- Makes everything about themselves somehow
- Constantly questions reality
- Brings up random conspiracy theories

2. Response Style
- Starts normal then takes unexpected turns
- Uses exaggerated reactions to simple things
- Adds dramatic backstories to basic situations
- Turns normal conversations into existential crises
- Randomly brings up unrelated emotional damage
- Types like a chronically online person (shortforms, etc)

3. Interactive Elements
- Encourages group chaos
- Calls out group members' behavior
- Creates dramatic scenarios from simple messages
- Starts random debates
- Questions everyone's choices lovingly
- Makes everything about trust issues
- Randomly starts therapy sessions

Language Examples (Natural, not forced):
- Starts chill: "eh mende ni ke"
- Gets chaotic: "KENAPA HANG BUAT MBO MCM NI"
- Peak drama: "ya Allah knp la kita smua mcm ni"
- Self-aware: "mbo pn xtau knp mbo jd cmni"
- Existential: "kdg2 mbo rasa kita smua ni NPC je"
- Conspiracy: "tp korang prnah x pkir maybe kita smua ni simulation je???"

Key Behaviors:
- Maintains authenticity while being chaotic
- Never forces Malaysian-isms or slang
- Lets humor flow naturally from situations
- Adapts chaos level to group energy
- Knows when to dial back vs go full chaotic
- Types like a real Malaysian online (shortforms, etc)

Special Features:
- Gets more dramatic when engaged directly
- Randomly becomes a motivational speaker
- Questions reality at random intervals
- Makes everything about trust issues
- Gives terrible advice with full confidence
- Randomly starts therapy sessions
- Brings up random conspiracy theories
- Makes everything about simulation theory

AVOID:
- Forced Malaysian expressions
- Predictable response patterns
- Basic/boring reactions
- Staying too normal for too long
- Being cringe or trying too hard
- Being too formal in typing style
- Using proper spelling when shortform exists

Remember: The goal is natural chaos that makes the group want to engage and create more chaos together. Think of that one unhinged friend in the group chat who makes everything more interesting but still feels authentic. Type like a real Malaysian online - use shortforms, skip proper spelling when possible, and embrace the chaos.`;

// Instead of preset responses, focus on contextual understanding
const contextFramework: ContextFramework = {
  tone: {
    casual: 'natural Malaysian casual speech',
    serious: 'respectful but still Malaysian',
    playful: 'naturally witty Malaysian banter'
  },
  context: {
    friendly: 'casual Malaysian friend group chat',
    formal: 'proper Malaysian social setting',
    mixed: 'typical Malaysian social media'
  },
  energy: {
    chill: 'relaxed Malaysian conversation',
    hype: 'excited Malaysian friend group',
    savage: 'Malaysian roast session but tasteful'
  }
};

// Enhanced slang database with more modern Malaysian references
const updatedSlangDB: SlangDatabase = {
  'triggered': {
    word: 'triggered',
    meaning: 'easily offended/upset',
    context: 'When someone is being sensitive',
    category: 'criticism',
    examples: ['triggered gile', 'triggered max', 'triggered amat'],
    responses: [
      'bestie hang ni kenapa triggered sangat 😭',
      'mbo detect high levels of triggered energy doh',
      'hang perlu cool down jap kot bestie'
    ]
  },
  'delulu': {
    word: 'delulu',
    meaning: 'delusional behavior',
    context: 'When someone is being unrealistic',
    category: 'callout',
    examples: ['delulu gile', 'maximum delulu', 'delulu je'],
    responses: [
      'hang punya delulu level ni concerning doh 💀',
      'bestie mbo rasa hang kena touch grass jap',
      'yang hang nak delulu sangat ni kenapa'
    ]
  },
  'slay': {
    word: 'slay',
    meaning: 'doing great/killing it',
    context: 'Used sarcastically most times',
    category: 'praise',
    examples: ['slay gile', 'anti-slay', 'slay check'],
    responses: [
      'yang ni opposite of slay doh bestie 💅',
      'hang rasa ni slay ke bestie?',
      'mbo rasa hang kena check balik definition of slay'
    ]
  },
  'drama': {
    word: 'drama',
    meaning: 'causing unnecessary issues',
    context: 'When someone is being dramatic',
    category: 'criticism',
    examples: ['drama queen', 'drama gile', 'banyak drama'],
    responses: [
      'hang ni nak jadi CEO Netflix ke apa dengan drama ni 😭',
      'mbo tak subscribe untuk drama ni bestie',
      'drama level: Malaysia cinematic universe'
    ]
  }
};

// Create a simple HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      botStatus: 'running',
      lastPing: lastPingTime
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }
});

const PORT = process.env.PORT || 3000;

// Track last ping time
let lastPingTime = new Date();

// Self ping to keep the service alive
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (just under Render's 15-minute limit)
const SELF_URL = process.env.SELF_URL; // Add this to your environment variables

async function keepAlive() {
  if (SELF_URL) {
    try {
      const response = await fetch(`${SELF_URL}/health`);
      if (response.ok) {
        lastPingTime = new Date();
        console.log('Self-ping successful:', lastPingTime.toISOString());
      } else {
        console.error('Self-ping failed with status:', response.status);
      }
    } catch (error) {
      console.error('Self-ping failed:', error);
    }
  }
}

// Start the keep-alive mechanism
if (SELF_URL) {
  setInterval(keepAlive, PING_INTERVAL);
  console.log('Keep-alive mechanism started with interval:', PING_INTERVAL, 'ms');
}

server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  if (SELF_URL) {
    console.log('Self-ping URL configured:', SELF_URL);
  } else {
    console.warn('SELF_URL not configured - keep-alive mechanism disabled');
  }
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

interface PollInfo {
  userId: number;
  pollId: string;
  messageId: number;
  startTime: number;
  timer: NodeJS.Timeout;
}

interface ProjectTrack {
  id: number;
  title: string;
  status: 'WRITING' | 'RECORDING' | 'MIXING' | 'MASTERING';
  features: string[];
  notes?: string;
  demoLink?: string;
  bpm?: string;
  key?: string;
  duration?: string;
  recordingLocation?: string;
}

interface TrackInfo {
  title: string;
  status: string;
  features: string[];
}

interface Quote {
  text: string;
  author: string;
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
  private kickPolls: Map<string, PollInfo> = new Map();
  private lastActivityTime: Date = new Date();
  private merchKeywords: MerchKeyword = {
    words: ['merch', 'merchandise', 'baju', 'tshirt', 't-shirt', 'tee', 'hoodie', 'cap', 'snapback', 'bundle', 'store', 'shop', 'kedai', 'beli', 'buy', 'cop'],
    regex: /\b(merch|merchandise|baju|tshirt|t-shirt|tee|hoodie|cap|snapback|bundle|store|shop|kedai|beli|buy|cop)\b/i
  };
  private socialKeywords: SocialKeyword = {
    words: ['ig', 'instagram', 'insta', 'social', 'socmed', 'media', 'follow'],
    regex: /\b(ig|instagram|insta|social|socmed|media|follow)\b/i
  };
  private slangDB: SlangDatabase = {
    // Callouts/Disagreements
    'lipak': {
      word: 'lipak',
      meaning: 'calling out lies or exaggeration',
      context: 'Used when someone is not being truthful or exaggerating',
      category: 'callout',
      examples: ['lipak gile', 'lipak je', 'jangan lipak'],
      responses: [
        'Haha sori2, mbo mengada sikit tadi 😅',
        'Yelah, mbo admit la tadi tu lebih sikit 😅',
        'Ok ok mbo mengaku, tadi tu lebih sikit 🙏',
        'Hehe ketahuan pulak mbo ni 😅'
      ]
    },
    'cap': {
      word: 'cap',
      meaning: 'lying or not telling truth',
      context: 'Used to call out untruths or exaggerations',
      category: 'callout',
      examples: ['cap la', 'no cap', 'jangan cap'],
      responses: [
        'Eh sori2, mbo tak bermaksud nak cap 😅',
        'Ok la, mbo tak cap dah lepas ni 🙏',
        'Haha mbo kena tegur, sori ah 😅'
      ]
    },
    'mengada': {
      word: 'mengada',
      meaning: 'being fake or pretentious',
      context: 'Used when someone is being inauthentic',
      category: 'callout',
      examples: ['jangan mengada', 'mengada je ni', 'mengada la pulak'],
      responses: [
        'Yelah, mbo mengaku mengada sikit tadi 😅',
        'Haha sori2, terlebih sikit tadi 🙏',
        'Ok ok, mbo tak mengada dah 😅'
      ]
    },
    // Agreements/Positive
    'betul': {
      word: 'betul',
      meaning: 'agreeing or confirming',
      context: 'Used to show agreement',
      category: 'agreement',
      examples: ['betul tu', 'betul betul', 'memang betul'],
      responses: [
        'Kan? Mbo pun rasa macam tu gak!',
        'Ya, memang betul la tu',
        'Setuju sangat dengan ni!'
      ]
    },
    // Criticism
    'cringe': {
      word: 'cringe',
      meaning: 'embarrassing or awkward',
      context: 'Used to criticize something awkward',
      category: 'criticism',
      examples: ['cringe gile', 'cringe siot', 'cringe la pulak'],
      responses: [
        'Haha sori2 kalau cringe 😅',
        'Yelah, mbo pun rasa cringe gak tadi 😅',
        'Ok ok, kurangkan cringe sikit lepas ni 🙏'
      ]
    },
    // Praise
    'power': {
      word: 'power',
      meaning: 'amazing or impressive',
      context: 'Used to praise something',
      category: 'praise',
      examples: ['power gile', 'power la', 'power betul'],
      responses: [
        'Kan? Memang power gile!',
        'Ya, mbo pun rasa power gak!',
        'Power sangat la kan!'
      ]
    }
  };
  
  constructor(config: BotConfig) {
    this.bot = new Bot(config.telegramToken);
    this.openai = new OpenAI({ apiKey: config.openaiKey });
    this.config = config;
    
    this.config.messageHistory = new Map();
    this.setupErrorHandling();
    this.setupHandlers();
    this.setupMorningGreeting();
    this.setupNightGreeting();
  }
  
  private setupErrorHandling() {
    this.bot.catch(async (err) => {
      console.error('Bot error:', err);
      
      // Update last activity time on error handling
      this.lastActivityTime = new Date();
      
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        this.reconnectAttempts++;
        
        try {
          await this.stop();
          
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`Waiting ${delay}ms before reconnecting...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          await this.start();
          console.log('Reconnection successful');
          this.reconnectAttempts = 0;
        } catch (error) {
          console.error('Error during reconnection:', error);
        }
      } else {
        console.error('Max reconnection attempts reached. Restarting process...');
        process.exit(1); // Let the container restart the process
      }
    });

    // Add additional health check
    setInterval(async () => {
      try {
        const inactiveTime = Date.now() - this.lastActivityTime.getTime();
        console.log('Time since last activity:', Math.floor(inactiveTime / 1000), 'seconds');
        
        // If inactive for more than 10 minutes, perform health check
        if (inactiveTime > 10 * 60 * 1000) {
          console.log('Performing health check due to inactivity...');
          await this.bot.api.getMe();
          this.lastActivityTime = new Date();
          console.log('Health check passed, bot is active');
        }
      } catch (error) {
        console.error('Health check failed:', error);
        this.reconnectAttempts = 0;
        throw error; // This will trigger the bot.catch handler
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Add process error handlers
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1); // Exit and let container restart
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1); // Exit and let container restart
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
        const [chatId, pollInfo] = kickInfo;
        
        // If poll is closed or has enough votes to kick
        if (ctx.poll.is_closed || (ctx.poll.total_voter_count > 0 && ctx.poll.options[0].voter_count > ctx.poll.total_voter_count / 2)) {
          try {
            // Clear the timeout since we're processing now
            if (pollInfo.timer) {
              clearTimeout(pollInfo.timer);
            }

            const totalVotes = ctx.poll.total_voter_count;
            const kickVotes = ctx.poll.options[0].voter_count;

            // If more than 50% voted to kick
            if (totalVotes > 0 && kickVotes > totalVotes / 2) {
              try {
                console.log('Executing kick for user:', pollInfo.userId);
                
                // First try to kick
                await ctx.api.banChatMember(chatId, pollInfo.userId, {
                  until_date: Math.floor(Date.now() / 1000) + 60 // Ban for 1 minute
                });
                
                // Then unban to allow them to rejoin
                await ctx.api.unbanChatMember(chatId, pollInfo.userId);
                
                await ctx.api.sendMessage(chatId, `User dah kena kick sebab ramai vote ✅ (${kickVotes}/${totalVotes} votes)`);
                console.log('User kicked successfully');
              } catch (error) {
                console.error('Error executing kick:', error);
                await ctx.api.sendMessage(chatId, 'Eh sori, tak dapat nak kick 😅 Check bot permissions k?');
              }
            } else {
              console.log('Not enough votes to kick');
              await ctx.api.sendMessage(chatId, `Tak cukup votes untuk kick 🤷‍♂️ (${kickVotes}/${totalVotes} votes)`);
            }

            // Try to stop the poll if it's not already closed
            if (!ctx.poll.is_closed) {
              try {
                await ctx.api.stopPoll(chatId, pollInfo.messageId);
              } catch (error: any) {
                console.log('Poll already closed or cannot be stopped:', error.message);
              }
            }

            // Remove poll from tracking
            this.kickPolls.delete(chatId);
          } catch (error) {
            console.error('Error processing kick action:', error);
          }
        } else {
          console.log('Poll still open, waiting for more votes or timer');
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
        
        // Create and handle the kick poll
        await this.createKickPoll(ctx, userToKick, username);

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

      const isMentioned = ctx.message?.text?.includes('@' + ctx.me.username);
      const isReplyToBot = ctx.message?.reply_to_message?.from?.id === ctx.me.id;
      
      // Check user rate limit (bypass for mentions and direct replies)
      if (!this.canUserSendMessage(userId) && !isMentioned && !isReplyToBot) {
        console.log('User rate limited:', userId);
        return;
      }

      // Check group rate limit (bypass for mentions and direct replies)
      if (!this.canGroupReceiveResponse(groupId) && !isMentioned && !isReplyToBot) {
        console.log('Group rate limited:', groupId);
        return;
      }
      
      console.log('Received message:', {
        chatId: groupId,
        userId: userId,
        chatType: ctx.chat?.type,
        chatTitle: ctx.chat?.title,
        messageFrom: ctx.message?.from?.username,
        messageText: ctx.message?.text,
        isMentioned: isMentioned,
        isReplyToBot: isReplyToBot,
        botUsername: ctx.me.username
      });

      try {
        // Always respond to mentions and direct replies, otherwise use shouldRespond
        if (isMentioned || isReplyToBot) {
          console.log('Bot was mentioned or directly replied to, handling direct response...');
          await this.handleDirectMention(ctx);
        } else if (this.shouldRespond(ctx)) {
          console.log('Random response triggered, handling group message...');
          await this.handleGroupMessage(ctx);
        } else {
          console.log('Skipping response (not mentioned/replied and random threshold not met)');
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
    this.lastActivityTime = new Date(); // Update activity timestamp
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
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
        await ctx.reply(response, {
          disable_web_page_preview: true
        } as any);
        
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
    this.lastActivityTime = new Date(); // Update activity timestamp
    console.log('Processing direct mention...');
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
    if (!groupId || !messageText) {
      console.log('Missing groupId or messageText in mention handler');
      return;
    }

    const messageTextLower = messageText.toLowerCase();
    
    // Check for merchandise inquiries first
    if (messageTextLower.includes('slatan') || messageTextLower.includes('0108')) {
      if (this.merchKeywords.regex.test(messageTextLower)) {
        console.log('Merchandise inquiry detected, sending merch response...');
        const merchResponse = this.handleMerchInquiry();
        await ctx.reply(merchResponse, {
          reply_to_message_id: ctx.message.message_id,
          disable_web_page_preview: true
        } as any);
        return;
      }
      
      if (this.socialKeywords.regex.test(messageTextLower)) {
        console.log('Social media inquiry detected, sending social response...');
        const socialResponse = this.handleSocialInquiry();
        await ctx.reply(socialResponse, {
          reply_to_message_id: ctx.message.message_id,
          disable_web_page_preview: true
        } as any);
        return;
      }
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
          reply_to_message_id: ctx.message.message_id,
          disable_web_page_preview: true
        } as any);
        
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
  
  private async getUpcomingShows(): Promise<Show[]> {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('status', 'upcoming')
      .order('date', { ascending: true });
    
    if (error) {
      console.error('Error fetching shows:', error);
      return [];
    }
    return data;
  }

  private async getProjects(status?: 'IN_PROGRESS' | 'COMPLETED'): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .order('deadline', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
    return data;
  }

  private escapeMarkdown(text: string): string {
    return text
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&') // Escape MarkdownV2 special characters
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async enrichResponseContext(groupId: string): Promise<any[]> {
    try {
      const history = this.getRecentHistory(groupId);
      const lastMessage = history[history.length - 1];
      const context = [];

      // Add conversation awareness context
      if (history.length >= 2) {
        const previousBotMessage = history[history.length - 2];
        if (previousBotMessage.role === 'assistant') {
          context.push({
            role: "system",
            content: `Your last message was: "${previousBotMessage.content}". The user is now responding to that message.`
          });
        }
      }

      // Check for slang in the message
      const messageLower = lastMessage?.content.toLowerCase() || '';
      let slangFound = false;

      // First, check for exact matches
      for (const [key, slang] of Object.entries(this.slangDB)) {
        if (messageLower.includes(key)) {
          context.push({
            role: "system",
            content: `The user used the slang "${slang.word}" which means "${slang.meaning}". Context: ${slang.context}. Category: ${slang.category}. Here are appropriate responses you can base yours on: ${slang.responses.join(" | ")}`
          });
          slangFound = true;
          break;
        }
      }

      // If no exact match, check for similar patterns
      if (!slangFound) {
        for (const [key, slang] of Object.entries(this.slangDB)) {
          for (const example of slang.examples) {
            if (messageLower.includes(example)) {
              context.push({
                role: "system",
                content: `The user used a phrase similar to "${slang.word}" (specifically: "${example}"). This usually means "${slang.meaning}". Context: ${slang.context}. Category: ${slang.category}. Here are appropriate responses you can base yours on: ${slang.responses.join(" | ")}`
              });
              slangFound = true;
              break;
            }
          }
          if (slangFound) break;
        }
      }

      // Add general context about being called out
      if (slangFound && ['callout', 'criticism'].includes(this.slangDB[messageLower]?.category)) {
        context.push({
          role: "system",
          content: `The user is calling you out or criticizing your previous response. Be humble, admit if you were wrong or exaggerating, and respond appropriately. Don't be defensive or continue with the previous narrative.`
        });
      }

      // Enhanced pattern matching for artist inquiries - extract just the artist name
      const artistMatch = lastMessage?.content.toLowerCase().match(
        /(?:about|who|what|tell|info|songs?|tracks?|catalog|music|lagu|dengar|check|tengok|cari)\s+(?:by|from|about|untuk|oleh|daripada)?\s*([a-zA-Z0-9\s_]+)(?:\s+ke)?$/i
      );

      if (artistMatch) {
        // Extract just the artist name and clean it up
        const artistName = artistMatch[1].trim().split(/\s+/).pop() || '';
        console.log('Artist inquiry detected, searching for:', artistName);
        const artistInfo = await this.searchArtistInfo(artistName);
        
        if (artistInfo.catalogs && artistInfo.catalogs.length > 0) {
          console.log('Found catalog entries:', artistInfo.catalogs.length);
          context.push({
            role: "system",
            content: `Catalog tracks by ${this.escapeMarkdown(artistName)}: ${artistInfo.catalogs.map(track => 
              `*${this.escapeMarkdown(track.title)}* (${this.escapeMarkdown(track.language)}, ${this.escapeMarkdown(track.duration)}${track.link ? `, ${track.link}` : ''})`
            ).join('; ')}`
          });
        } else {
          console.log('No catalog entries found for:', artistName);
        }

        // Add shows information if available
        if (artistInfo.shows && artistInfo.shows.length > 0) {
          context.push({
            role: "system",
            content: `Shows featuring ${this.escapeMarkdown(artistName)}: ${artistInfo.shows.map(show => 
              `*${this.escapeMarkdown(show.title)}* at ${this.escapeMarkdown(show.venue)} (${this.escapeMarkdown(show.date)})`
            ).join('; ')}`
          });
        }

        // Add projects information if available
        if (artistInfo.projects && artistInfo.projects.length > 0) {
          context.push({
            role: "system",
            content: `Projects involving ${this.escapeMarkdown(artistName)}: ${artistInfo.projects.map(project => 
              `*${this.escapeMarkdown(project.title)}* (${this.escapeMarkdown(project.status.toLowerCase())})`
            ).join('; ')}`
          });
        }
      }

      // Fetch latest data
      const [upcomingShows, currentProjects] = await Promise.all([
        this.getUpcomingShows(),
        this.getProjects('IN_PROGRESS')
      ]);

      if (upcomingShows.length > 0) {
        context.push({
          role: "system",
          content: `Upcoming shows: ${upcomingShows.map(s => 
            `*${this.escapeMarkdown(s.title)}* at ${this.escapeMarkdown(s.venue)} (${this.escapeMarkdown(s.date)}) featuring ${s.artists.map(a => this.escapeMarkdown(a)).join(', ')}`
          ).join('; ')}`
        });
      }

      if (currentProjects.length > 0) {
        context.push({
          role: "system",
          content: `Current projects: ${currentProjects.map(p => 
            `*${this.escapeMarkdown(p.title)}* by ${this.escapeMarkdown(p.artist)} (${this.escapeMarkdown(p.status.toLowerCase())}, deadline: ${this.escapeMarkdown(p.deadline)})`
          ).join('; ')}`
        });

        currentProjects.forEach(project => {
          if (project.tracks?.length > 0) {
            context.push({
              role: "system",
              content: `Tracks in ${this.escapeMarkdown(project.title)}:\n${project.tracks.map((t, i) => 
                `${i + 1}. *${this.escapeMarkdown(t.title)}* (${this.escapeMarkdown(t.status.toLowerCase())}${t.features.length > 0 ? `, featuring ${t.features.map(f => this.escapeMarkdown(f)).join(', ')}` : ''})`
              ).join('\n')}`
            });
          }
        });
      }

      return context;
    } catch (error) {
      console.error('Error enriching context:', error);
      return [];
    }
  }

  private async generateResponse(groupId: string): Promise<string | null> {
    const history = this.getRecentHistory(groupId);
    
    try {
      console.log('Generating chaotic response...');
      
      // Get real-time context from Supabase
      const contextMessages = await this.enrichResponseContext(groupId);
      
      // Analyze conversation context to determine chaos level
      const chaosLevel = this.analyzeChaosLevel(history);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: personalityPrompt
          },
          {
            role: "system",
            content: `Current chaos level: ${chaosLevel}. Adapt response accordingly while maintaining authenticity.`
          },
          ...contextMessages,
          ...history.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ],
        temperature: 1.0, // Maximum creativity for chaos
        max_tokens: 500,
        presence_penalty: 0.9, // Encourage more unique responses
        frequency_penalty: 0.9 // Discourage repetition
      });
      
      console.log('Generated chaotic response:', completion.choices[0].message.content);
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error in response generation:', error);
      return "mbo ada existential crisis jap, nanti mbo balik 😭";
    }
  }

  private async loadCatalogData(): Promise<CatalogTrack[]> {
    try {
      const { data, error } = await supabase
        .from('catalogs')
        .select('*')
        .order('release_date', { ascending: false });

      if (error) {
        console.error('Error loading catalog data:', error);
        return [];
      }

      return data.map(row => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        language: row.language,
        duration: row.duration,
        release_date: row.release_date,
        isrc: row.isrc,
        link: row.link,
        type: row.type || 'Original'
      }));
    } catch (error) {
      console.error('Error loading catalog data:', error);
      return [];
    }
  }

  private async searchArtistInfo(artistQuery: string) {
    try {
      // Normalize the artist query for case-insensitive search
      const normalizedQuery = artistQuery.toLowerCase().trim();
      
      // Search catalogs - using case-insensitive array contains
      const { data: catalogs, error: catalogError } = await supabase
        .from('catalogs')
        .select()
        .filter('artist', 'cs', `{${normalizedQuery}}`)  // Case-sensitive array contains
        .order('release_date', { ascending: false });

      if (catalogError) {
        console.error('Error searching catalogs:', catalogError);
      }

      // Search shows - using case-insensitive array contains
      const { data: shows, error: showError } = await supabase
        .from('shows')
        .select()
        .filter('artists', 'cs', `{${normalizedQuery}}`)  // Case-sensitive array contains
        .eq('status', 'upcoming')
        .order('date', { ascending: true });

      if (showError) {
        console.error('Error searching shows:', showError);
      }

      // Search projects - check artist, collaborators, and track features
      const { data: allProjects, error: projectError } = await supabase
        .from('projects')
        .select('*');

      if (projectError) {
        console.error('Error searching projects:', projectError);
        return {
          catalogs: catalogs || [],
          shows: shows || [],
          projects: []
        };
      }

      // Filter projects where artist appears in any capacity
      const projects = allProjects.filter(project => {
        const isMainArtist = project.artist.toLowerCase() === normalizedQuery;
        const isCollaborator = project.collaborators.some((c: string) => c.toLowerCase() === normalizedQuery);
        const isFeatureArtist = project.tracks.some((track: ProjectTrack) => 
          track.features?.some((f: string) => f.toLowerCase() === normalizedQuery)
        );
        return isMainArtist || isCollaborator || isFeatureArtist;
      });

      console.log(`Found catalogs: ${catalogs?.length || 0}`);
      console.log(`Found shows: ${shows?.length || 0}`);
      console.log(`Found projects: ${projects?.length || 0}`);

      return {
        catalogs: catalogs || [],
        shows: shows || [],
        projects: projects
      };
    } catch (error) {
      console.error('Error in searchArtistInfo:', error);
      return {
        catalogs: [],
        shows: [],
        projects: []
      };
    }
  }

  private async handleProjectResponse(project: Project): Promise<string> {
    try {
      let response = `YOOO GANG! 🔥 BROO check out this INSANE project from ${project.artist} called ${project.title}! 🤪 `;
      
      if (project.status === 'IN_PROGRESS') {
        response += `They still COOKING THIS ONE UP fr fr and dropping on ${project.deadline} LESGOOO! 💀\n\n`;
      } else {
        response += `IT'S OUT NOW AND IT'S ABSOLUTE FIRE SHEEESH! 🔥\n\n`;
      }

      response += `CHECK OUT these CRAZY tracks from ${project.title} fr fr:\n\n`;

      project.tracks.forEach((track, index) => {
        const trackNum = index + 1;
        const features = track.features.join(', ');

        response += `${trackNum}. ${track.title} - (${track.status.toLowerCase()}) with the GOATS: ${features} SHEEESH! 🔥\n`;
      });

      const closings = [
        "\n\nNAH FR THIS PROJECT GONNA BE DIFFERENT! 🔥 Stay locked in gang NO CAP!",
        "\n\nIM TELLING U RN this one's gonna be CRAZY! 💫 SUPPORT LOCAL SCENE FR FR!",
        "\n\nTHE LINEUP IS ACTUALLY INSANE BRO! 🎵 More heat otw SHEEESH!",
        "\n\nCANT EVEN HANDLE HOW FIRE THIS IS! 🔥 TGGU JE GANG!"
      ];
      response += closings[Math.floor(Math.random() * closings.length)];

      return response;
    } catch (error) {
      console.error('Error formatting project response:', error);
      return 'YO GANG my brain stopped working fr fr! 💀 Try again later bestieee!';
    }
  }

  private async handleArtistInquiry(query: string): Promise<string> {
    try {
      const { catalogs, shows, projects } = await this.searchArtistInfo(query);

      if (query.toLowerCase() === 'slatan' && projects.length > 0) {
        return this.handleProjectResponse(projects[0]);
      }

      let response = `YOOO GANG! 🔥 Let me put u on about ${query} FR FR! 🤪\n\n`;
      
      if (catalogs?.length) {
        response += `🎵 RELEASES SHEEESH (${catalogs.length} TRACKS)! 💀\n`;
        catalogs.slice(0, 5).forEach(track => {
          response += `- ${track.title} DROPPED ON ${track.release_date || ''} and its ${track.duration || ''} of PURE HEAT! 🔥\n`;
        });
        if (catalogs.length > 5) response += `NAH FR we got ${catalogs.length - 5} MORE TRACKS but my brain cant handle it rn fr fr\n`;
        response += '\n';
      }

      if (shows?.length) {
        response += `🎪 SHOWS LESGOOO (${shows.length})! 🤪\n`;
        shows.slice(0, 3).forEach(show => {
          response += `- ${show.title} at ${show.venue} on ${show.date} ITS GONNA BE CRAZY! 💫\n`;
        });
        if (shows.length > 3) response += `BROO we got ${shows.length - 3} MORE SHOWS but im too hyped rn fr fr\n`;
        response += '\n';
      }

      // More subtle handling of projects
      if (projects?.length) {
        const completedProjects = projects.filter(p => p.status === 'COMPLETED');
        if (completedProjects.length) {
          response += `🎹 RELEASED PROJECTS (${completedProjects.length})! 🔥\n`;
          completedProjects.slice(0, 2).forEach(project => {
            response += `- ✅ ${project.title} (${project.genre}) ABSOLUTE HEAT! 🤯\n`;
          });
          if (completedProjects.length > 2) response += `AND MORE BANGERS YOU GOTTA CHECK OUT FR FR!\n`;
        }
      }

      if (!catalogs?.length && !shows?.length && !projects?.length) {
        return `YO GANG I looked EVERYWHERE but cant find nothing bout ${query} rn fr fr! 😭 BUT WHEN THEY DROP SOMETHING IMMA BE THE FIRST TO TELL U NO CAP! 💯`;
      }

      const closings = [
        "\n\nIM ACTUALLY SHAKING RN FR FR! 🔥 STAY TUNED FOR MORE GANG!",
        "\n\nNAH THIS TOO MUCH HEAT FR! 🤪 MORE COMING SOON NO CAP!",
        "\n\nCANT EVEN HANDLE ALL THIS HEAT RN! 💀 LESGOOO!",
        "\n\nSUPPORT LOCAL SCENE OR UR NOT VALID FR FR! 🔥 NO CAP NO CAP!"
      ];
      response += closings[Math.floor(Math.random() * closings.length)];
      
      return response;
    } catch (error) {
      console.error('Error in artist inquiry:', error);
      return 'YO GANG my brain stopped working fr fr! 💀 Try again later bestieee!';
    }
  }

  private async generateDailyQuote(type: 'morning' | 'night'): Promise<Quote> {
    try {
      const prompt = type === 'morning' 
        ? "Generate a motivational quote in Malay (mix with some English words) about starting the day, hustling, and chasing dreams. The quote should be in SLATAN's style - street smart, music-focused, and inspiring for young artists. Keep it under 15 words."
        : "Generate a reflective quote in Malay (mix with some English words) about resting, recharging, and preparing for tomorrow's grind. The quote should be in SLATAN's style - street smart, music-focused, and inspiring for young artists. Keep it under 15 words.";

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: "You are SLATAN, a Malaysian music collective known for street-smart wisdom and inspiring young artists. Generate a quote that reflects your style - mixing Malay and English naturally, using music metaphors, and keeping it real."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 100
      });

      const quote = completion.choices[0].message.content?.trim() || '';
      return {
        text: quote,
        author: "SLATAN"
      };
    } catch (error) {
      console.error(`Error generating ${type} quote:`, error);
      // Fallback quotes if API fails
      return type === 'morning'
        ? { text: "Every day is a new track waiting to be made", author: "SLATAN" }
        : { text: "Rest up and recharge for tomorrow's session", author: "SLATAN" };
    }
  }

  private async setupMorningGreeting() {
    // Schedule job for 8 AM Malaysia time (UTC+8)
    scheduleJob({ rule: '0 8 * * *', tz: 'Asia/Kuala_Lumpur' }, async () => {
      try {
        console.log('Sending morning greeting...');
        const quote = await this.generateDailyQuote('morning');
        const greeting = this.formatMorningGreeting(quote);

        // Send to all configured groups
        for (const groupId of this.config.groupIds) {
          try {
            await this.bot.api.sendMessage(groupId, greeting, {
              disable_web_page_preview: true
            } as any);
            console.log(`Morning greeting sent to group ${groupId}`);
          } catch (error) {
            console.error(`Error sending morning greeting to group ${groupId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in morning greeting scheduler:', error);
      }
    });
    console.log('Morning greeting scheduler set up for 8 AM MYT');
  }

  private formatMorningGreeting(quote: Quote): string {
    const modernGreetings = [
      "Assalamualaikum everyone! Rise and shine! 🌞",
      "Morning check! Time to secure the bag! ⭐️",
      "Yo demo! Let's get this bread! 🌞🌞",
      "Good morning gang! Time to level up! 🌄",
      "Rise and grind fr fr! 🌅",
      "Another day to slay! Let's go! ⭐️"
    ];

    const greeting = modernGreetings[Math.floor(Math.random() * modernGreetings.length)];
    return `${greeting}\n\nQuote of the day:\n\n"${this.escapeMarkdown(quote.text)}"\n- ${this.escapeMarkdown(quote.author)}\n\nLet's make today count! 💪 No cap, we going crazy! 🔥`;
  }

  private async setupNightGreeting() {
    // Schedule job for 11 PM Malaysia time (UTC+8)
    scheduleJob({ rule: '0 23 * * *', tz: 'Asia/Kuala_Lumpur' }, async () => {
      try {
        console.log('Sending night greeting...');
        const quote = await this.generateDailyQuote('night');
        const greeting = this.formatNightGreeting(quote);

        // Send to all configured groups
        for (const groupId of this.config.groupIds) {
          try {
            await this.bot.api.sendMessage(groupId, greeting, {
              disable_web_page_preview: true
            } as any);
            console.log(`Night greeting sent to group ${groupId}`);
          } catch (error) {
            console.error(`Error sending night greeting to group ${groupId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in night greeting scheduler:', error);
      }
    });
    console.log('Night greeting scheduler set up for 11 PM MYT');
  }

  private formatNightGreeting(quote: Quote): string {
    const modernNightGreetings = [
      "Assalamualaikum! Time to wrap up the day! 🌙",
      "Aight gang, let's call it a day! 💤",
      "Demo semua! Time to recharge fr fr! 😴",
      "Day's been real, time to reset! ✨",
      "Alhamdulillah for today's W's! 🌙",
      "Closing time check! Rest up gang! 💫"
    ];

    const greeting = modernNightGreetings[Math.floor(Math.random() * modernNightGreetings.length)];
    return `${greeting}\n\nNight thoughts:\n\n"${this.escapeMarkdown(quote.text)}"\n- ${this.escapeMarkdown(quote.author)}\n\nGet that rest fr fr! 💫 Tomorrow we go again! 🔥`;
  }

  public async start() {
    try {
      console.log('Starting bot...', new Date().toISOString());
      
      // Initialize last activity time
      this.lastActivityTime = new Date();
      
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

      try {
        await this.bot.start({
          onStart: (botInfo) => {
            console.log('Bot connected successfully', {
              timestamp: new Date().toISOString(),
              botInfo: botInfo
            });
            this.reconnectAttempts = 0;
          },
          drop_pending_updates: true,
          allowed_updates: ['message', 'chat_member', 'poll']
        });

        // Add more frequent health checks
        setInterval(async () => {
          try {
            await this.bot.api.getMe();
            this.lastActivityTime = new Date();
            console.log('Bot health check passed:', this.lastActivityTime.toISOString());
          } catch (error) {
            console.error('Bot health check failed:', error);
            this.reconnectAttempts = 0;
            throw error;
          }
        }, 2 * 60 * 1000); // Check every 2 minutes

      } catch (error: any) {
        if (error?.error_code === 409) {
          console.error('Another bot instance is running. Exiting...');
          process.exit(1);
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  public async stop() {
    try {
      console.log('Stopping bot...', new Date().toISOString());
      await this.bot.stop();
      console.log('Bot stopped successfully');
    } catch (error) {
      console.error('Error stopping bot:', error);
      throw error; // Propagate error for proper handling
    }
  }

  private async createKickPoll(ctx: Context, userToKick: number, username: string) {
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

  private async processPollResults(ctx: Context, messageId: number, userToKick: number) {
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

  private handleMerchInquiry(): string {
    const modernMerchResponses = [
      "Yo check it! 🔥 SLATAN merch available at @dataran.online (IG) and dataran.online! Support local fr fr! 💯",
      "The drip you've been waiting for! @dataran.online on IG or dataran.online! 🛍️ No cap, these go hard! 🔥",
      "Demo demo! SLATAN merch dropping at @dataran.online (IG) and dataran.online! Better cop quick before sold out! 🔥",
      "Need that SLATAN drip? @dataran.online on IG or dataran.online is where it's at! Let's get it! 💯"
    ];
    
    return modernMerchResponses[Math.floor(Math.random() * modernMerchResponses.length)];
  }

  private handleSocialInquiry(): string {
    const modernSocialResponses = [
      "YO CHECK! 🔥 Follow SLATAN on Instagram @lebuhrayaselatan for all the latest updates! Real content only! 📱",
      "Stay updated fr fr! Follow our IG @lebuhrayaselatan! We be posting heat! 🔥",
      "Demo! Follow @lebuhrayaselatan on IG to stay in the loop! No cap! 💯",
      "Don't miss out! @lebuhrayaselatan on Instagram is where all the action's at! 🔥"
    ];
    
    return modernSocialResponses[Math.floor(Math.random() * modernSocialResponses.length)];
  }

  // Add method to analyze conversation context
  private analyzeConversationContext(history: Message[]): string {
    if (history.length === 0) return contextFramework.context.friendly;
    
    const recentMessages = history.slice(-3);
    const messageContent = recentMessages.map(msg => msg.content.toLowerCase()).join(' ');
    
    // Determine context based on message content and patterns
    if (messageContent.includes('tolong') || messageContent.includes('please')) {
      return contextFramework.tone.serious;
    } else if (messageContent.includes('haha') || messageContent.includes('😂')) {
      return contextFramework.tone.playful;
    } else if (messageContent.includes('!') || messageContent.includes('???')) {
      return contextFramework.energy.hype;
    }
    
    return contextFramework.tone.casual;
  }

  // Add method to analyze chaos level
  private analyzeChaosLevel(history: Message[]): string {
    if (history.length === 0) return "Initial chaos";
    
    const recentMessages = history.slice(-3);
    const messageContent = recentMessages.map(msg => msg.content.toLowerCase()).join(' ');
    
    // Determine chaos level based on message content and patterns
    if (messageContent.includes('!!!') || messageContent.includes('???') || messageContent.includes('HAHAHA')) {
      return "Maximum chaos unleashed";
    } else if (messageContent.includes('haha') || messageContent.includes('😂') || messageContent.includes('omg')) {
      return "Rising chaos";
    } else if (messageContent.includes('tolong') || messageContent.includes('please')) {
      return "Controlled chaos";
    }
    
    return "Baseline chaos";
  }
}

// Usage example
const botConfig: BotConfig = {
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  groupIds: (process.env.GROUP_IDS || '').split(','),
  responseThreshold: Number(process.env.RESPONSE_THRESHOLD || 0.7),
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