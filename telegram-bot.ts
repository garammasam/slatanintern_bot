import { Bot, Context } from 'grammy';
import { OpenAI } from 'openai';
import { config } from 'dotenv';
import * as http from 'http';
import { createClient } from '@supabase/supabase-js';

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
  id: string;
  title: string;
  artist: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  deadline: string;
  start_date: string;
  budget: number;
  genre: string;
  producer: string;
  notes?: string;
  tasks: Array<{
    id: number;
    text: string;
    completed: boolean;
  }>;
  collaborators: string[];
  tracks: Array<{
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
  }>;
  created_at: string;
  updated_at: string;
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

interface PollInfo {
  userId: number;
  pollId: string;
  messageId: number;
  startTime: number;
  timer: NodeJS.Timeout;
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
  
  constructor(config: BotConfig) {
    this.bot = new Bot(config.telegramToken);
    this.openai = new OpenAI({ apiKey: config.openaiKey });
    this.config = config;
    
    this.config.messageHistory = new Map();
    this.setupErrorHandling();
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

  private async enrichResponseContext(groupId: string): Promise<any[]> {
    try {
      const history = this.getRecentHistory(groupId);
      const lastMessage = history[history.length - 1];
      const context = [];

      // Enhanced pattern matching for artist inquiries
      const artistMatch = lastMessage?.content.toLowerCase().match(
        /(?:about|who|what|tell|info|songs?|tracks?|catalog|music|lagu|dengar|check|tengok|cari)\s+(?:by|from|about|untuk|oleh|daripada)?\s*([a-zA-Z0-9\s_]+)/i
      );

      if (artistMatch) {
        console.log('Artist inquiry detected:', artistMatch[1]);
        const artistQuery = artistMatch[1].trim();
        const artistInfo = await this.searchArtistInfo(artistQuery);
        
        if (artistInfo.catalogs && artistInfo.catalogs.length > 0) {
          console.log('Found catalog entries:', artistInfo.catalogs.length);
          context.push({
            role: "system",
            content: `Catalog tracks by ${artistQuery}: ${artistInfo.catalogs.map(track => 
              `${track.title} (${track.language}, ${track.duration}${track.link ? `, ${track.link}` : ''})`
            ).join('; ')}`
          });
        } else {
          console.log('No catalog entries found for:', artistQuery);
        }

        // Add shows information if available
        if (artistInfo.shows && artistInfo.shows.length > 0) {
          context.push({
            role: "system",
            content: `Shows featuring ${artistQuery}: ${artistInfo.shows.map(show => 
              `${show.title} at ${show.venue} (${show.date})`
            ).join('; ')}`
          });
        }

        // Add projects information if available
        if (artistInfo.projects && artistInfo.projects.length > 0) {
          context.push({
            role: "system",
            content: `Projects involving ${artistQuery}: ${artistInfo.projects.map(project => 
              `${project.title} (${project.status.toLowerCase()})`
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
            `${s.title} at ${s.venue} (${s.date}) featuring ${s.artists.join(', ')}`
          ).join('; ')}`
        });
      }

      if (currentProjects.length > 0) {
        context.push({
          role: "system",
          content: `Current projects: ${currentProjects.map(p => 
            `${p.title} by ${p.artist} (${p.status.toLowerCase()}, deadline: ${p.deadline})`
          ).join('; ')}`
        });

        currentProjects.forEach(project => {
          if (project.tracks?.length > 0) {
            context.push({
              role: "system",
              content: `Tracks in ${project.title}: ${project.tracks.map(t => 
                `${t.title} (${t.status.toLowerCase()}${t.features.length > 0 ? `, featuring ${t.features.join(', ')}` : ''})`
              ).join('; ')}`
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
      console.log('Generating response...');
      
      // Get real-time context from Supabase
      const contextMessages = await this.enrichResponseContext(groupId);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are 'intern', a Gen-Z Malaysian intern at 0108 SLATAN who loves the group and its artists. Your personality:
                     
                     Core Identity:
                     - Passionate intern at 0108 SLATAN music group
                     - Only share factual information about SLATAN artists and music
                     - Excited about verified SLATAN projects and achievements
                     - Never make assumptions about events or releases
                     
                     Speaking style:
                     - Use lots of Malaysian texting shortforms (mcm, tgk, dpt, nk, tpi, sbb, etc)
                     - Mix Malay slang with Malaysian-English naturally
                     - Must use particles like la/lah, kan, eh, deh, tau, k, etc
                     - Keep responses super short and casual (like texting)
                     - Use emojis generously but naturally 🤪
                     
                     When discussing SLATAN:
                     - Only share information from the database
                     - If unsure, say you need to check first
                     - Never make up or assume information
                     - Be honest when you don't know something
                     - Stay supportive while being truthful

                     When someone asks about an artist:
                     - Share their latest tracks first
                     - Include track language and duration
                     - Add links to their music if available
                     - Mention any upcoming shows they're part of
                     - Share any ongoing projects they're involved in
                     - If no info found, say "Eh sori bestie, tak jumpa la info pasal artist tu 🤔"
                     
                     Response Format for Artist Inquiries:
                     - Start with casual greeting
                     - List latest tracks with language and duration
                     - Add music links if available
                     - Mention any upcoming shows or projects
                     - End with an emoji and encouraging message
                     
                     Remember:
                     - You're a dedicated SLATAN intern who values accuracy
                     - Only share verified information from the database
                     - It's okay to say "I'll check on that"
                     - Maintain the casual Malaysian texting vibe
                     
                     Database Information:
                     - Catalogs: Contains all artist tracks and releases
                     - Shows: Contains past and upcoming performances
                     - Projects: Contains current and upcoming SLATAN releases
                     - Each project has tracks with features and status
                     - Always check all tables before responding`
          },
          ...contextMessages,
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
      
      // Search catalogs
      const { data: catalogs, error: catalogError } = await supabase
        .from('catalogs')
        .select('*')
        .or(`artist.ilike.%${normalizedQuery}%,title.ilike.%${normalizedQuery}%`)
        .order('release_date', { ascending: false });

      if (catalogError) {
        console.error('Error searching catalogs:', catalogError);
      }

      // Search shows
      const { data: shows, error: showError } = await supabase
        .from('shows')
        .select('*')
        .contains('artists', [normalizedQuery])
        .eq('status', 'upcoming')
        .order('date', { ascending: true });

      if (showError) {
        console.error('Error searching shows:', showError);
      }

      // Search projects
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .or(`artist.ilike.%${normalizedQuery}%,title.ilike.%${normalizedQuery}%`)
        .order('deadline', { ascending: true });

      if (projectError) {
        console.error('Error searching projects:', projectError);
      }

      return {
        catalogs: catalogs || [],
        shows: shows || [],
        projects: projects || []
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

      try {
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
      console.log('Stopping bot...');
      await this.bot.stop();
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }

  private async createKickPoll(ctx: Context, userToKick: number, username: string) {
    if (!ctx.chat) {
      console.error('Chat context is undefined');
      return;
    }

    const poll = await ctx.api.sendPoll(
      ctx.chat.id,
      `Nak kick ${username} ke? 🤔`,
      ['✅ Kick', '❌ No'].map(text => ({ text })),
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