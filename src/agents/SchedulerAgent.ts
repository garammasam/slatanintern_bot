import { scheduleJob } from 'node-schedule';
import { ISchedulerAgent, ICoreAgent, Quote } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class SchedulerAgent implements ISchedulerAgent {
  private coreAgent: ICoreAgent;
  private personalityService: PersonalityService;
  private morningJob: any;
  private nightJob: any;

  constructor(coreAgent: ICoreAgent) {
    console.log('⏰ SchedulerAgent: Initializing...');
    this.coreAgent = coreAgent;
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    console.log('⏰ SchedulerAgent: Setting up scheduled tasks...');
    this.setupMorningGreeting();
    this.setupNightGreeting();
  }

  public async shutdown(): Promise<void> {
    console.log('⏰ SchedulerAgent: Shutting down...');
    if (this.morningJob) {
      this.morningJob.cancel();
    }
    if (this.nightJob) {
      this.nightJob.cancel();
    }
  }

  public setupMorningGreeting(): void {
    // Schedule morning greeting at 8:00 AM Malaysia time
    this.morningJob = scheduleJob('0 8 * * *', async () => {
      try {
        const quote = await this.generateDailyQuote('morning');
        const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
        const sassiness = this.personalityService.getPersonalityTrait('sassiness');
        
        let greeting = '';
        if (enthusiasm > 0.7) {
          greeting = "WAKE UP BOZOS! TIME FOR ANOTHER L! 🌅";
        } else if (sassiness > 0.7) {
          greeting = "Rise and L! Touch some grass today! 🌞";
        } else {
          greeting = "Another day another L! 🌄";
        }

        const message = this.personalityService.addPersonalityParticles(
          `${greeting}\n\n${quote.text}\n- ${quote.author}`,
          'roast'
        );

        // Send to all configured groups
        const groups = this.coreAgent.getConfig().groupIds;
        for (const groupId of groups) {
          try {
            await this.coreAgent.getBot().api.sendMessage(groupId, message);
          } catch (error) {
            console.error(`Error sending morning greeting to group ${groupId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in morning greeting job:', error);
      }
    });
  }

  public setupNightGreeting(): void {
    // Schedule night greeting at 11:00 PM Malaysia time
    this.nightJob = scheduleJob('0 23 * * *', async () => {
      try {
        const quote = await this.generateDailyQuote('night');
        const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
        const sassiness = this.personalityService.getPersonalityTrait('sassiness');
        
        let greeting = '';
        if (enthusiasm > 0.7) {
          greeting = "YO GANG! TIME TO SLEEP ON THEM Ls! 🌙";
        } else if (sassiness > 0.7) {
          greeting = "Go to bed! Touch grass tomorrow! 😴";
        } else {
          greeting = "Time to rest those L rizz skills! 🌙";
        }

        const message = this.personalityService.addPersonalityParticles(
          `${greeting}\n\n${quote.text}\n- ${quote.author}`,
          'roast'
        );

        // Send to all configured groups
        const groups = this.coreAgent.getConfig().groupIds;
        for (const groupId of groups) {
          try {
            await this.coreAgent.getBot().api.sendMessage(groupId, message);
          } catch (error) {
            console.error(`Error sending night greeting to group ${groupId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in night greeting job:', error);
      }
    });
  }

  public async generateDailyQuote(type: 'morning' | 'night'): Promise<Quote> {
    const enthusiasm = this.personalityService.getPersonalityTrait('enthusiasm');
    const sassiness = this.personalityService.getPersonalityTrait('sassiness');
    const personalityInfo = this.personalityService.getPersonalityInfo();

    // Select quotes based on time of day and personality
    const morningQuotes: Quote[] = [
      {
        text: "Rise and grind? More like rise and find another L! 💀",
        author: "Savage Amat"
      },
      {
        text: "New day, new opportunities to catch these Ls! Keep that same energy!",
        author: "Motivational Amat"
      },
      {
        text: "Imagine sleeping in when you could be catching Ls! Couldn't be me fr fr!",
        author: "Grindset Amat"
      }
    ];

    const nightQuotes: Quote[] = [
      {
        text: "Sleep is just a temporary escape from your Ls! See you tomorrow! 💀",
        author: "Philosophical Amat"
      },
      {
        text: "Today's L is tomorrow's motivation! Keep that same energy!",
        author: "Reflective Amat"
      },
      {
        text: "Can't take Ls while sleeping! Unless...? 🤔",
        author: "Night Owl Amat"
      }
    ];

    const quotes = type === 'morning' ? morningQuotes : nightQuotes;
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quote = quotes[randomIndex];

    // Add personality to the quote
    return {
      text: this.personalityService.addPersonalityParticles(quote.text, 'roast'),
      author: enthusiasm > 0.7 ? `${quote.author} 💀` : quote.author
    };
  }
} 