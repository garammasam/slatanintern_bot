import { scheduleJob } from 'node-schedule';
import { ISchedulerAgent, ICoreAgent, Quote } from '../types';
import { OpenAI } from 'openai';

export class SchedulerAgent implements ISchedulerAgent {
  private coreAgent: ICoreAgent;
  private openai: OpenAI;
  private morningJob: any;
  private nightJob: any;

  constructor(coreAgent: ICoreAgent) {
    this.coreAgent = coreAgent;
    this.openai = new OpenAI({ apiKey: coreAgent.getConfig().openaiKey });
  }

  public async initialize(): Promise<void> {
    this.setupMorningGreeting();
    this.setupNightGreeting();
  }

  public async shutdown(): Promise<void> {
    if (this.morningJob) {
      this.morningJob.cancel();
    }
    if (this.nightJob) {
      this.nightJob.cancel();
    }
  }

  public setupMorningGreeting(): void {
    // Schedule job for 8 AM Malaysia time (UTC+8)
    this.morningJob = scheduleJob({ rule: '0 8 * * *', tz: 'Asia/Kuala_Lumpur' }, async () => {
      try {
        console.log('Sending morning greeting...');
        const quote = await this.generateDailyQuote('morning');
        const greeting = this.formatMorningGreeting(quote);

        // Send to all configured groups
        const config = this.coreAgent.getConfig();
        const bot = this.coreAgent.getBot();
        
        for (const groupId of config.groupIds) {
          try {
            await bot.api.sendMessage(groupId, greeting, {
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

  public setupNightGreeting(): void {
    // Schedule job for 11 PM Malaysia time (UTC+8)
    this.nightJob = scheduleJob({ rule: '0 23 * * *', tz: 'Asia/Kuala_Lumpur' }, async () => {
      try {
        console.log('Sending night greeting...');
        const quote = await this.generateDailyQuote('night');
        const greeting = this.formatNightGreeting(quote);

        // Send to all configured groups
        const config = this.coreAgent.getConfig();
        const bot = this.coreAgent.getBot();
        
        for (const groupId of config.groupIds) {
          try {
            await bot.api.sendMessage(groupId, greeting, {
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

  public async generateDailyQuote(type: 'morning' | 'night'): Promise<Quote> {
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

  private formatMorningGreeting(quote: Quote): string {
    const modernGreetings = [
      "Assalamualaikum everyone! Rise and shine! 🌞",
      "Morning check! Time to secure the bag! ⭐️",
      "Yo demo! Let's get this bread! 🌞",
      "Good morning gang! Time to level up! 🌄",
      "Rise and grind fr fr! 🌅",
      "Another day to slay! Let's go! ⭐️"
    ];

    const greeting = modernGreetings[Math.floor(Math.random() * modernGreetings.length)];
    return `${greeting}\n\nQuote of the day:\n\n"${this.escapeMarkdown(quote.text)}"\n- ${this.escapeMarkdown(quote.author)}\n\nLet's make today count! 💪 No cap, we going crazy! 🔥`;
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

  private escapeMarkdown(text: string): string {
    return text
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
} 