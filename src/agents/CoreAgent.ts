import { Bot, Context } from 'grammy';
import { ICoreAgent, BotConfig } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class CoreAgent implements ICoreAgent {
  private bot: Bot;
  private config: BotConfig;
  private personalityService: PersonalityService;
  private isRunning: boolean = false;

  constructor(config: BotConfig) {
    console.log('🤖 CoreAgent: Initializing...');
    this.config = config;
    this.bot = new Bot(config.telegramToken);
    this.personalityService = new PersonalityService();

    // Set up error handling
    this.bot.catch((err) => {
      console.error('🤖 CoreAgent: Bot error:', err);
    });
  }

  public async initialize(): Promise<void> {
    console.log('🤖 CoreAgent: Setting up bot...');
    
    // Set up basic command handlers
    this.setupCommands();
    
    // Set up error handling middleware
    this.setupErrorHandling();
    
    console.log('🤖 CoreAgent: Bot setup complete');
  }

  public async shutdown(): Promise<void> {
    console.log('🤖 CoreAgent: Shutting down...');
    if (this.isRunning) {
      await this.stop();
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 CoreAgent: Bot is already running');
      return;
    }

    console.log('🤖 CoreAgent: Starting bot...');
    try {
      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show help message' },
        { command: 'kick', description: 'Start a kick vote' },
        { command: 'info', description: 'Show bot info' }
      ]);

      this.isRunning = true;
      await this.bot.start();
      console.log('🤖 CoreAgent: Bot started successfully');
    } catch (error) {
      console.error('🤖 CoreAgent: Failed to start bot:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('🤖 CoreAgent: Bot is not running');
      return;
    }

    console.log('🤖 CoreAgent: Stopping bot...');
    try {
      await this.bot.stop();
      this.isRunning = false;
      console.log('🤖 CoreAgent: Bot stopped successfully');
    } catch (error) {
      console.error('🤖 CoreAgent: Failed to stop bot:', error);
      throw error;
    }
  }

  public getBot(): Bot {
    return this.bot;
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  private setupCommands(): void {
    // Handle /start command
    this.bot.command('start', async (ctx) => {
      const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
      const personalityInfo = this.personalityService.getPersonalityInfo();
      
      let greeting = enthusiasm > 0.7
        ? `YO GANG! ${personalityInfo.name} IN THE HOUSE! 🔥`
        : `Hi! I'm ${personalityInfo.name}! 👋`;

      const response = this.personalityService.addPersonalityParticles(
        `${greeting}\n\n${personalityInfo.bio}`,
        'greeting'
      );

      await ctx.reply(response);
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
      const formality = this.personalityService.getPersonalityTrait('formality');
      
      let helpMessage = '';
      
      if (enthusiasm > 0.7) {
        helpMessage = `YO FAM! Here's what I can do for you:
🎵 Ask me about SLATAN artists and releases!
🎪 Get info about upcoming shows!
🛍️ Check out our merch!
📱 Find our socials!
🎮 Just vibe with the gang!`;
      } else if (formality > 0.7) {
        helpMessage = `Hello! Here are my main features:
• Information about SLATAN artists and releases
• Details about upcoming shows and events
• Merchandise information
• Social media links
• General conversation and engagement`;
      } else {
        helpMessage = `Hey! Check out what I can do:
• Get you the latest on SLATAN artists
• Keep you updated on shows
• Hook you up with merch info
• Share our social links
• Chat and hang out!`;
      }

      const response = this.personalityService.addPersonalityParticles(helpMessage, 'helpful');
      await ctx.reply(response);
    });

    // Handle /info command
    this.bot.command('info', async (ctx) => {
      const personalityInfo = this.personalityService.getPersonalityInfo();
      const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
      
      let infoMessage = enthusiasm > 0.7
        ? `YO CHECK IT OUT! 🔥\n\n${personalityInfo.bio}\n\nMADE WITH LOVE BY THE SLATAN GANG! 💯`
        : `About me:\n\n${personalityInfo.bio}\n\nDeveloped by SLATAN`;

      const response = this.personalityService.addPersonalityParticles(infoMessage, 'informative');
      await ctx.reply(response);
    });
  }

  private setupErrorHandling(): void {
    this.bot.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        console.error('🤖 CoreAgent: Error in middleware:', error);
        
        // Get personality-based error message
        const errorMessage = this.getPersonalityErrorMessage();
        
        try {
          await ctx.reply(errorMessage);
        } catch (replyError) {
          console.error('🤖 CoreAgent: Failed to send error message:', replyError);
        }
      }
    });
  }

  private getPersonalityErrorMessage(): string {
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    const sassiness = this.personalityService.getPersonalityTrait('sassiness');
    
    let baseMessage = '';
    
    if (enthusiasm > 0.7) {
      baseMessage = "YO GANG something went wrong fr fr! Let's try that again in a bit! 😅";
    } else if (sassiness > 0.7) {
      baseMessage = "Bruh my brain stopped working for a sec! Hit me up again later k? 🤪";
    } else {
      baseMessage = "Oops! Something went wrong. Please try again later! 🙏";
    }

    return this.personalityService.addPersonalityParticles(baseMessage, 'apologetic');
  }
} 