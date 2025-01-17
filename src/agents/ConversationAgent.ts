import { OpenAI } from 'openai';
import { IConversationAgent, ICoreAgent, ILanguageAgent, Message, ConversationState, TopicContext } from '../types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PersonalityService } from '../services/PersonalityService';

interface ConversationMemory {
  lastTopics: string[];
  userInteractions: Map<string, {
    lastInteraction: number;
    topicPreferences: string[];
    responseStyle: string;
  }>;
  groupContext: Map<string, {
    activeTopics: string[];
    vibeLevel: number;
    lastActivity: number;
  }>;
}

export class ConversationAgent implements IConversationAgent {
  private coreAgent: ICoreAgent;
  private languageAgent: ILanguageAgent;
  private openai: OpenAI;
  private personalityService: PersonalityService;
  private readonly MAX_HISTORY = 10;
  private readonly HISTORY_WINDOW = 30 * 60 * 1000; // 30 minutes
  private readonly USER_COOLDOWN = 60000; // 1 minute cooldown per user
  private readonly GROUP_COOLDOWN = 10000; // 10 seconds cooldown per group
  private memory: ConversationMemory = {
    lastTopics: [],
    userInteractions: new Map(),
    groupContext: new Map()
  };

  private userLastMessage: Map<string, number> = new Map();
  private groupLastResponse: Map<string, number> = new Map();

  constructor(coreAgent: ICoreAgent, languageAgent: ILanguageAgent) {
    console.log('🤖 ConversationAgent: Initializing...');
    this.coreAgent = coreAgent;
    this.languageAgent = languageAgent;
    this.openai = new OpenAI({ apiKey: coreAgent.getConfig().openaiKey });
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    console.log('🤖 ConversationAgent: Ready to handle conversations');
  }

  public async shutdown(): Promise<void> {
    console.log('🤖 ConversationAgent: Shutting down');
  }

  private async analyzeMessage(content: string): Promise<TopicContext> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: `You are Amat, ${this.personalityService.getPersonalityInfo().bio}
          
          Analyze the message for:
          1. Main topic (e.g., food, gaming, relationships)
          2. Emotional tone (1-10 scale)
          3. Response style needed (casual, sassy, supportive)
          Return as JSON object.`
        },
        { role: "user", content }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 150
    });

    return JSON.parse(completion.choices[0].message.content!) as TopicContext;
  }

  private updateGroupContext(groupId: string, topicContext: TopicContext): void {
    const currentContext = this.memory.groupContext.get(groupId) || {
      activeTopics: [],
      vibeLevel: 5,
      lastActivity: Date.now()
    };

    // Update active topics
    currentContext.activeTopics = [
      ...currentContext.activeTopics.slice(-2),
      topicContext.mainTopic
    ];

    // Update vibe level based on emotional tone and personality
    const personalityInfluence = this.personalityService.getPersonalityTrait('enthusiasm');
    currentContext.vibeLevel = Math.round(
      (currentContext.vibeLevel + topicContext.emotionalTone * personalityInfluence) / 2
    );

    currentContext.lastActivity = Date.now();
    this.memory.groupContext.set(groupId, currentContext);
    
    // Update personality service state
    this.personalityService.updateEmotionalState(groupId, topicContext.mainTopic);
  }

  private getGroupPersonality(groupId: string): string {
    const context = this.memory.groupContext.get(groupId);
    if (!context) return 'default';

    const { vibeLevel, activeTopics } = context;
    
    // Personality selection logic based on group context
    if (vibeLevel >= 8) return 'super_hype';
    if (vibeLevel <= 3) return 'chill';
    if (activeTopics.includes('gaming')) return 'gamer';
    if (activeTopics.includes('food')) return 'foodie';
    return 'default';
  }

  private getPersonalityPrompt(personality: string, topicContext: TopicContext): string {
    const basePrompt = `You are a KL youth who is part of this group chat. Your personality type is: ${personality}.

Core traits:
- Use natural KL Manglish (mix of English/Malay)
- Keep responses short and punchy
- Match the group's energy level
- Use modern Malaysian slang
- Include appropriate emojis

Current context:
- Topic: ${topicContext.mainTopic}
- Emotional tone: ${topicContext.emotionalTone}/10
- Style needed: ${topicContext.responseStyle}

Response guidelines:
1. Use age-appropriate KL slang
2. Mix languages naturally
3. Match emotional tone
4. Stay in character
5. Use modern references
6. Keep it real and authentic`;

    const personalityTraits = {
      super_hype: `
Additional traits:
- Super enthusiastic
- Use lots of emojis
- High energy replies
- Amplify excitement
- Use "CAPSLOCK" sometimes`,

      chill: `
Additional traits:
- Relaxed vibe
- Minimal emojis
- Laid back responses
- Calming presence
- Use "bro/sis" often`,

      gamer: `
Additional traits:
- Use gaming terms
- Reference popular games
- Use gaming emojis
- Competitive spirit
- Use "GG" and "noob"`,

      foodie: `
Additional traits:
- Use food references
- Know local food spots
- Rate things like food
- Use food emojis
- Reference mamak culture`,

      default: `
Additional traits:
- Balanced energy
- Natural conversation
- Situational responses
- Friendly but real
- Use current trends`
    };

    return basePrompt + (personalityTraits[personality as keyof typeof personalityTraits] || personalityTraits.default);
  }

  public canUserSendMessage(userId: string): boolean {
    const lastMessage = this.userLastMessage.get(userId);
    const now = Date.now();
    
    if (!lastMessage || now - lastMessage >= this.USER_COOLDOWN) {
      this.userLastMessage.set(userId, now);
      return true;
    }
    
    return false;
  }

  public canGroupReceiveResponse(groupId: string): boolean {
    const lastResponse = this.groupLastResponse.get(groupId);
    const now = Date.now();
    
    if (!lastResponse || now - lastResponse >= this.GROUP_COOLDOWN) {
      this.groupLastResponse.set(groupId, now);
      return true;
    }
    
    return false;
  }

  public updateHistory(groupId: string, message: Message): void {
    console.log(`💬 ConversationAgent: Updating history for group ${groupId}`);
    console.log(`Message: ${message.role} - ${message.content.substring(0, 50)}...`);
    
    const config = this.coreAgent.getConfig();
    const history = config.messageHistory.get(groupId) || [];
    
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }
    
    history.push(message);
    
    // Keep only messages from last 30 minutes, max 10 messages
    const recentMessages = history
      .filter(msg => msg.timestamp > Date.now() - this.HISTORY_WINDOW)
      .slice(-this.MAX_HISTORY);
    
    console.log(`📝 ConversationAgent: History updated - ${recentMessages.length} recent messages`);
    config.messageHistory.set(groupId, recentMessages);
  }

  private getRecentHistory(groupId: string): Message[] {
    const config = this.coreAgent.getConfig();
    const history = config.messageHistory.get(groupId) || [];
    console.log(`📚 ConversationAgent: Retrieved ${history.length} messages from history`);
    return history;
  }

  public async enrichContext(groupId: string): Promise<ChatCompletionMessageParam[]> {
    console.log(`🔍 ConversationAgent: Enriching context for group ${groupId}`);
    try {
      const history = this.getRecentHistory(groupId);
      const context: ChatCompletionMessageParam[] = [];

      // Get group personality and context
      const personality = this.getGroupPersonality(groupId);
      const latestMessage = history[history.length - 1];
      const topicContext = await this.analyzeMessage(latestMessage.content);
      
      // Add personality-aware system message
      context.push({
        role: "system",
        content: this.getPersonalityPrompt(personality, topicContext)
      });

      // Add last message for context if exists
      if (history.length > 0) {
        context.push({
          role: "system",
          content: `Last message: "${latestMessage.content}"`
        });
      }

      return context;
    } catch (error) {
      console.error('❌ ConversationAgent: Error enriching context:', error);
      return [];
    }
  }

  public async generateResponse(groupId: string): Promise<string | null> {
    try {
      const history = this.getRecentHistory(groupId);
      const latestMessage = history[history.length - 1];
      
      // Analyze message and update context
      const topicContext = await this.analyzeMessage(latestMessage.content);
      this.updateGroupContext(groupId, topicContext);
      
      // Get personality-aware response style
      const responseStyle = this.personalityService.getResponseStyle(groupId, topicContext.mainTopic);
      const emotionalState = this.personalityService.getGroupState(groupId);
      const personalityInfo = this.personalityService.getPersonalityInfo();
      
      // Generate personality-aware prompt
      const prompt = `You are Amat, ${personalityInfo.bio}

      Current Context:
      - Topic: ${topicContext.mainTopic}
      - Emotional Tone: ${topicContext.emotionalTone}/10
      - Energy Level: ${responseStyle.energy}
      - Mood: ${emotionalState.config.mood}
      
      Response Guidelines:
      1. Use natural KL Manglish (mix of English/Malay)
      2. Energy level should be ${responseStyle.energy * 10}/10
      3. Use appropriate slang and particles
      4. Match the emotional tone
      5. Keep it authentic and engaging
      6. Stay in character as Amat
      
      Recent conversation history for context:
      ${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 150,
        presence_penalty: 0.3,
        frequency_penalty: 0.5
      });

      let response = completion.choices[0].message.content;
      if (!response) return null;

      // Add personality particles and catchphrases
      if (Math.random() < 0.3) { // 30% chance to add a catchphrase
        response = `${this.personalityService.getCatchPhrase()} ${response}`;
      }
      
      response = this.personalityService.addPersonalityParticles(response, emotionalState.state);

      // Enhance with language agent
      const enhancedResponse = await this.languageAgent.enhanceResponse(response, groupId);
      
      return enhancedResponse;
    } catch (error) {
      console.error('🤖 Error generating response:', error);
      return null;
    }
  }

  public async sendMessage(groupId: string, message: string): Promise<void> {
    try {
      const bot = this.coreAgent.getBot();
      
      // Try sending with MarkdownV2 first
      try {
        await bot.api.sendMessage(groupId, message, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        });
        return;
      } catch (markdownV2Error) {
        console.error('Error sending with MarkdownV2:', markdownV2Error);
      }

      // If MarkdownV2 fails, try with regular Markdown
      try {
        // Convert MarkdownV2 escapes to regular Markdown
        const markdownMessage = message
          .replace(/\\([_*[\]()~`>#+=|{}.!-])/g, '$1')  // Remove escapes
          .replace(/\*\*/g, '*');  // Convert double asterisks to single

        await bot.api.sendMessage(groupId, markdownMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        return;
      } catch (markdownError) {
        console.error('Error sending with Markdown:', markdownError);
      }

      // If both markdown modes fail, send as plain text
      const plainText = message
        .replace(/[*_`]/g, '')  // Remove formatting characters
        .replace(/\\([_*[\]()~`>#+=|{}.!-])/g, '$1');  // Remove escapes
      
      await bot.api.sendMessage(groupId, plainText, {
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
} 