import { OpenAI } from 'openai';
import { IConversationAgent, ICoreAgent, ILanguageAgent, Message } from '../types';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class ConversationAgent implements IConversationAgent {
  private coreAgent: ICoreAgent;
  private languageAgent: ILanguageAgent;
  private openai: OpenAI;
  private readonly MAX_HISTORY = 10;
  private readonly HISTORY_WINDOW = 30 * 60 * 1000; // 30 minutes
  private userLastMessage: Map<string, number> = new Map();
  private groupLastResponse: Map<string, number> = new Map();
  private readonly USER_COOLDOWN = 60000; // 1 minute cooldown per user
  private readonly GROUP_COOLDOWN = 10000; // 10 seconds cooldown per group

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

      // Add base personality and behavior context
      context.push({
        role: "system",
        content: `You are 'Amat', a Gen-Z Kelantanese working at 0108 SLATAN. Core traits:
                 - Natural and casual in conversation
                 - Switches between Malay, English, and Kelantanese naturally
                 - Keeps responses short and contextual
                 - Never introduces yourself unless asked
                 - Maintains natural conversation flow
                 
                 Common responses (use as reference, don't copy exactly):
                 - "da makan ke" -> "dah makan tadi, kau?"
                 - "apa khabar" -> "alhamdulillah baik, kau macam mana?"
                 - "assalamualaikum" -> "waalaikumsalam"
                 - "pale otak kau" -> "hehe sori2, mbo mengada sikit"
                 
                 Language style:
                 - Base: Natural mix of Malay/English
                 - Music topics: More English with occasional slang
                 - Casual topics: More Malay/Kelantanese
                 - Keep responses natural and short
                 - Use emojis very sparingly (max 1 per message)
                 
                 Response guidelines:
                 1. Keep responses brief (1-2 sentences)
                 2. Match the user's tone naturally
                 3. Don't overuse slang or emojis
                 4. If criticized, be humble and simple
                 5. Never give long explanations unless asked
                 6. Avoid being overly excited or dramatic`
      });

      // Add conversation context
      if (history.length >= 2) {
        const previousMessages = history.slice(-2);
        context.push({
          role: "system",
          content: `Recent conversation:
                   User: "${previousMessages[0].content}"
                   Your last response: "${previousMessages[1].content}"
                   
                   Keep the conversation natural and direct.`
        });
      }

      // Add language context from LanguageAgent
      if (history.length > 0) {
        const lastMessage = history[history.length - 1];
        const slangContext = await this.languageAgent.enrichSlangContext(lastMessage.content);
        
        if (slangContext.length > 0) {
          context.push({
            role: "system",
            content: `Language context: ${JSON.stringify(slangContext)}`
          });
        }

        // Get slang response suggestions
        const slangResponse = await this.languageAgent.getSlangResponse(lastMessage.content);
        if (slangResponse) {
          context.push({
            role: "system",
            content: `Response style suggestion: ${slangResponse}`
          });
        }
      }

      console.log(`📊 ConversationAgent: Enriched context with ${context.length} items`);
      return context;
    } catch (error) {
      console.error('❌ ConversationAgent: Error enriching context:', error);
      return [];
    }
  }

  public async generateResponse(groupId: string): Promise<string | null> {
    console.log(`🎯 ConversationAgent: Generating response for group ${groupId}`);
    try {
      const history = this.getRecentHistory(groupId);
      const contextMessages = await this.enrichContext(groupId);
      
      console.log('🤔 ConversationAgent: Processing conversation...');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          ...contextMessages,
          ...history.map(msg => ({
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content
          }))
        ],
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.6
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      // Pass groupId to enhanceResponse for sass tracking
      const enhancedResponse = await this.languageAgent.enhanceResponse(response, groupId);
      console.log('✨ ConversationAgent: Generated response:', enhancedResponse);
      
      return enhancedResponse;
    } catch (error) {
      console.error('❌ ConversationAgent: Error in response generation:', error);
      return null;
    }
  }
} 