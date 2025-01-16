import { config } from 'dotenv';
import { CoreAgent } from './agents/CoreAgent';
import { MessageAgent } from './agents/MessageAgent';
import { ConversationAgent } from './agents/ConversationAgent';
import { ModerationAgent } from './agents/ModerationAgent';
import { DatabaseAgent } from './agents/DatabaseAgent';
import { LanguageAgent } from './agents/LanguageAgent';
import { SchedulerAgent } from './agents/SchedulerAgent';
import { InquiryAgent } from './agents/InquiryAgent';
import { BotConfig } from './types';

// Load environment variables
config();

async function main() {
  try {
    console.log('🤖 Initializing Malaysian Group Chat Bot...');

    // Validate environment variables
    if (!process.env.TELEGRAM_TOKEN) {
      throw new Error('TELEGRAM_TOKEN is required');
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('Supabase configuration is required');
    }

    // Initialize configuration
    const botConfig: BotConfig = {
      telegramToken: process.env.TELEGRAM_TOKEN,
      openaiKey: process.env.OPENAI_API_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      groupIds: (process.env.ALLOWED_GROUP_IDS || '').split(','),
      responseThreshold: parseFloat(process.env.RESPONSE_THRESHOLD || '0.1'),
      messageHistory: new Map()
    };

    // Core Agent (Root)
    console.log('🌟 Initializing Core Agent...');
    const coreAgent = new CoreAgent(botConfig);
    await coreAgent.initialize();

    // Database Agent (Shared Resource)
    console.log('💾 Initializing Database Agent...');
    const databaseAgent = new DatabaseAgent();
    await databaseAgent.initialize();

    // Language Agent (Shared Resource)
    console.log('🗣️ Initializing Language Agent...');
    const languageAgent = new LanguageAgent();
    await languageAgent.initialize();

    // Conversation Agent (Uses Language Agent)
    console.log('💭 Initializing Conversation Agent...');
    const conversationAgent = new ConversationAgent(coreAgent, languageAgent);
    await conversationAgent.initialize();

    // Moderation Agent
    console.log('👮 Initializing Moderation Agent...');
    const moderationAgent = new ModerationAgent(coreAgent);
    await moderationAgent.initialize();

    // Inquiry Agent (Uses Database Agent)
    console.log('🔍 Initializing Inquiry Agent...');
    const inquiryAgent = new InquiryAgent(databaseAgent);
    await inquiryAgent.initialize();

    // Message Handler Agent (Coordinates all other agents)
    console.log('📨 Initializing Message Handler Agent...');
    const messageAgent = new MessageAgent(
      coreAgent,
      conversationAgent,
      moderationAgent,
      inquiryAgent
    );
    await messageAgent.initialize();

    // Set up message handling
    const bot = coreAgent.getBot();
    bot.on('message', async (ctx) => {
      await messageAgent.handleMessage(ctx);
    });

    // Scheduler Agent
    console.log('⏰ Initializing Scheduler Agent...');
    const schedulerAgent = new SchedulerAgent(coreAgent);
    await schedulerAgent.initialize();

    // Start the bot
    console.log('🚀 Starting bot...');
    await coreAgent.start();

    // Handle shutdown
    const shutdown = async () => {
      console.log('🛑 Shutting down...');
      await Promise.all([
        coreAgent.shutdown(),
        databaseAgent.shutdown(),
        languageAgent.shutdown(),
        conversationAgent.shutdown(),
        messageAgent.shutdown(),
        moderationAgent.shutdown(),
        schedulerAgent.shutdown(),
        inquiryAgent.shutdown()
      ]);
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    console.log('✅ Bot is ready!');

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main(); 