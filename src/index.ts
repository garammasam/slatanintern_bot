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
import * as http from 'http';

// Load environment variables
config();

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Received ${req.method} request to ${req.url}`);
  
  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
          hasToken: !!process.env.TELEGRAM_TOKEN,
          hasOpenAI: !!process.env.OPENAI_API_KEY,
          hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
          port: process.env.PORT || 3000
        }
      }));
    } else {
      // Root endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok',
        message: 'Malaysian Group Chat Bot is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
    }
    console.log(`[${new Date().toISOString()}] Request completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error handling request:`, error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    }));
  }
});

// Start HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] 🌐 HTTP server listening on port ${PORT}`);
  console.log('Environment check:', {
    hasToken: !!process.env.TELEGRAM_TOKEN,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
    port: PORT
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] HTTP server error:`, error);
  process.exit(1); // Exit on server error to allow container restart
});

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