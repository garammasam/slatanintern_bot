import { OpenAI } from 'openai';
import { IConversationAgent, ICoreAgent, ILanguageAgent, Message, ConversationState, TopicContext } from '../types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AMAT_PERSONALITY } from '../config/amat-personality';

interface ConversationMemory {
  lastTopics: string[];
  userInteractions: Map<string, {
    lastInteraction: number;
    topicPreferences: string[];
    responseStyle: string;
    sassLevel: number;
  }>;
  groupContext: Map<string, {
    activeTopics: string[];
    vibeLevel: number;
    lastActivity: number;
    sassLevel: number;
  }>;
}

export class ConversationAgent implements IConversationAgent {
  private coreAgent: ICoreAgent;
  private languageAgent: ILanguageAgent;
  private openai: OpenAI;
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
          content: `As ${AMAT_PERSONALITY.core.name}, analyze this message for:
            1. Main topic (e.g., music, gaming, relationships)
            2. Emotional tone (1-10 scale)
            3. Response style needed (casual, sassy, supportive)
            4. Potential roast opportunities (0-10 scale)
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
      lastActivity: Date.now(),
      sassLevel: AMAT_PERSONALITY.sassiness.default
    };

    // Update active topics
    currentContext.activeTopics = [
      ...currentContext.activeTopics.slice(-2),
      topicContext.mainTopic
    ];

    // Update vibe level based on emotional tone
    currentContext.vibeLevel = Math.round(
      (currentContext.vibeLevel + topicContext.emotionalTone) / 2
    );

    // Adjust sass level based on context
    if (topicContext.mainTopic.toLowerCase().includes('roast')) {
      currentContext.sassLevel = Math.min(
        currentContext.sassLevel + AMAT_PERSONALITY.sassiness.increment * 2,
        AMAT_PERSONALITY.sassiness.max
      );
    }

    currentContext.lastActivity = Date.now();
    this.memory.groupContext.set(groupId, currentContext);
  }

  private getGroupPersonality(groupId: string): string {
    const context = this.memory.groupContext.get(groupId);
    if (!context) return 'default';

    const { vibeLevel, activeTopics, sassLevel } = context;
    
    // Get personality based on sass level
    if (sassLevel >= AMAT_PERSONALITY.sassiness.thresholds.savage) return 'savage';
    if (sassLevel >= AMAT_PERSONALITY.sassiness.thresholds.spicy) return 'spicy';
    if (sassLevel <= AMAT_PERSONALITY.sassiness.thresholds.chill) return 'chill';
    
    // If no strong sass level, base it on context
    if (vibeLevel >= 8) return 'super_hype';
    if (vibeLevel <= 3) return 'chill';
    if (activeTopics.includes('music')) return 'music_enthusiast';
    if (activeTopics.includes('roast')) return 'savage';
    return 'default';
  }

  private getPersonalityPrompt(personality: string, topicContext: TopicContext): string {
    const { core, contextModifiers } = AMAT_PERSONALITY;

    const basePrompt = `You are ${core.name}, ${core.role}. ${core.background}

Core traits: ${core.traits.join(', ')}

Current context:
- Topic: ${topicContext.mainTopic}
- Emotional tone: ${topicContext.emotionalTone}/10
- Style needed: ${topicContext.responseStyle}

Response guidelines:
1. Use natural KL Manglish
2. Match emotional tone
3. Stay in character
4. Use modern references
5. Keep it real and authentic`;

    // Add context-specific modifiers
    if (topicContext.mainTopic.toLowerCase().includes('music')) {
      return basePrompt + `\n\nMusic mode activated:
- Enthusiasm: ${contextModifiers.music.enthusiasm}/10
- Slang density: ${contextModifiers.music.slangDensity}/10`;
    }

    if (personality === 'savage') {
      return basePrompt + `\n\nRoast mode activated:
- Intensity: ${contextModifiers.roasting.intensity}/10
- Humor: ${contextModifiers.roasting.humor}/10`;
    }

    return basePrompt;
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
      
      // Analyze the latest message for context
      const topicContext = await this.analyzeMessage(latestMessage.content);
      
      // Update group context with new information
      this.updateGroupContext(groupId, topicContext);
      
      // Get appropriate personality based on group context
      const personality = this.getGroupPersonality(groupId);
      
      // Generate personality-aware prompt
      const personalityPrompt = this.getPersonalityPrompt(personality, topicContext);

      console.log('🤖 Generating response with personality:', personality);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: personalityPrompt
          },
          ...history.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content
          }))
        ],
        temperature: 0.8,
        max_tokens: 60,
        presence_penalty: 0.3,
        frequency_penalty: 0.5
      });

      const response = completion.choices[0].message.content;
      if (!response) return null;

      // Enhance response with local slang and style
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