import { Bot } from 'grammy';
import { ICoreAgent, BotConfig } from '../types';

export class CoreAgent implements ICoreAgent {
  private bot: Bot;
  private config: BotConfig;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private lastActivityTime: Date = new Date();

  constructor(config: BotConfig) {
    console.log('🌟 CoreAgent: Initializing...');
    this.config = config;
    this.bot = new Bot(config.telegramToken);
  }

  public async initialize(): Promise<void> {
    console.log('🌟 CoreAgent: Setting up error handling...');
    this.setupErrorHandling();
  }

  public async shutdown(): Promise<void> {
    console.log('🌟 CoreAgent: Shutting down...');
    await this.stop();
  }

  public getBot(): Bot {
    return this.bot;
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      console.error('🌟 CoreAgent: Bot error:', err);
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        console.log(`🌟 CoreAgent: Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        this.start();
      } else {
        console.error('🌟 CoreAgent: Max reconnection attempts reached. Shutting down...');
        process.exit(1);
      }
    });
  }

  public async start(): Promise<void> {
    try {
      console.log('🌟 CoreAgent: Starting bot...', new Date().toISOString());
      
      // Initialize last activity time
      this.lastActivityTime = new Date();
      
      // Add error handler for process termination
      process.on('SIGTERM', async () => {
        console.log('🌟 CoreAgent: SIGTERM received. Shutting down gracefully...');
        await this.stop();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        console.log('🌟 CoreAgent: SIGINT received. Shutting down gracefully...');
        await this.stop();
        process.exit(0);
      });

      try {
        await this.bot.start({
          onStart: (botInfo) => {
            console.log('🌟 CoreAgent: Bot connected successfully', {
              timestamp: new Date().toISOString(),
              botInfo: botInfo
            });
            this.reconnectAttempts = 0;
          },
          drop_pending_updates: true,
          allowed_updates: ['message', 'chat_member', 'poll']
        });

        // Add health checks
        setInterval(async () => {
          try {
            await this.bot.api.getMe();
            this.lastActivityTime = new Date();
            console.log('🌟 CoreAgent: Bot health check passed:', this.lastActivityTime.toISOString());
          } catch (error) {
            console.error('🌟 CoreAgent: Bot health check failed:', error);
            this.reconnectAttempts = 0;
            throw error;
          }
        }, 2 * 60 * 1000); // Check every 2 minutes

      } catch (error: any) {
        if (error?.error_code === 409) {
          console.error('🌟 CoreAgent: Another bot instance is running. Exiting...');
          process.exit(1);
        }
        throw error;
      }
    } catch (error) {
      console.error('🌟 CoreAgent: Failed to start bot:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      console.log('🌟 CoreAgent: Stopping bot...', new Date().toISOString());
      await this.bot.stop();
      console.log('🌟 CoreAgent: Bot stopped successfully');
    } catch (error) {
      console.error('🌟 CoreAgent: Error stopping bot:', error);
      throw error;
    }
  }
} 