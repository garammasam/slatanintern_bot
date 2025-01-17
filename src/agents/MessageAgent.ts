import { Context } from 'grammy';
import { 
  IMessageAgent, 
  ICoreAgent, 
  IConversationAgent, 
  IModerationAgent, 
  IInquiryAgent,
  IDatabaseAgent 
} from '../types';

export class MessageAgent implements IMessageAgent {
  private coreAgent: ICoreAgent;
  private conversationAgent: IConversationAgent;
  private moderationAgent: IModerationAgent;
  private inquiryAgent: IInquiryAgent;
  private databaseAgent: IDatabaseAgent;

  // Common keywords that indicate artist/music queries
  private readonly ARTIST_QUERY_KEYWORDS = [
    'lagu', 'song', 'release', 'album', 'single',
    'project', 'projek', 'show', 'gig', 'concert',
    'perform', 'track', 'artist', 'musician', 'producer',
    'collaboration', 'collab', 'feat'
  ];

  // List of known artists to check against
  private readonly KNOWN_ARTISTS = [
    'jaystation', 'maatjet', 'offgrid', 'slatan', 'gard', 'gard wuzgut', 'wuzgut', 'johnasa', 'shilky', 'nobi', 'quai', 'ameeusement', 'akkimwaru'
    // Add more artists as needed
  ];

  constructor(
    coreAgent: ICoreAgent,
    conversationAgent: IConversationAgent,
    moderationAgent: IModerationAgent,
    inquiryAgent: IInquiryAgent,
    databaseAgent: IDatabaseAgent
  ) {
    console.log('📨 MessageAgent: Initializing...');
    this.coreAgent = coreAgent;
    this.conversationAgent = conversationAgent;
    this.moderationAgent = moderationAgent;
    this.inquiryAgent = inquiryAgent;
    this.databaseAgent = databaseAgent;
  }

  public async initialize(): Promise<void> {
    console.log('📨 MessageAgent: Ready to handle messages');
  }

  public async shutdown(): Promise<void> {
    console.log('📨 MessageAgent: Shutting down');
  }

  private isArtistQuery(text: string): boolean {
    const normalizedText = text.toLowerCase();
    
    // Check if message contains any artist query keywords
    const hasKeyword = this.ARTIST_QUERY_KEYWORDS.some(keyword => 
      normalizedText.includes(keyword)
    );

    // Check if message mentions any known artists
    const mentionsArtist = this.KNOWN_ARTISTS.some(artist => 
      normalizedText.includes(artist.toLowerCase())
    );

    // Common question patterns in Malay
    const questionPatterns = [
      /^apa (?:lagu|projek|show)/i,
      /^bila (?:lagu|show|concert)/i,
      /^mana (?:show|gig|concert)/i,
      /^siapa (?:feat|collab)/i
    ];

    const isQuestion = questionPatterns.some(pattern => 
      pattern.test(normalizedText)
    );

    return (hasKeyword && mentionsArtist) || isQuestion;
  }

  public async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString();
    const groupId = ctx.chat?.id.toString();
    
    if (!userId || !groupId) return;

    const isMentioned = ctx.message?.text?.includes('@' + ctx.me.username);
    const isReplyToBot = ctx.message?.reply_to_message?.from?.id === ctx.me.id;
    const messageText = ctx.message?.text;
    
    if (!messageText) return;

    // Log message details
    console.log('📨 MessageAgent: Processing message:', {
      chatId: groupId,
      userId: userId,
      chatType: ctx.chat?.type,
      chatTitle: ctx.chat?.title,
      messageFrom: ctx.message?.from?.username,
      messageText: messageText,
      isMentioned: isMentioned,
      isReplyToBot: isReplyToBot
    });

    try {
      // Check moderation first
      console.log('📨 MessageAgent: Passing message to ModerationAgent');
      const shouldModerate = await this.moderationAgent.shouldModerateMessage(ctx);
      if (shouldModerate) {
        console.log('📨 MessageAgent: Message requires moderation');
        return;
      }

      // Check rate limits for general messages
      if (!isMentioned && !isReplyToBot) {
        if (!this.conversationAgent.canUserSendMessage(userId)) {
          console.log('📨 MessageAgent: User rate limited:', userId);
          return;
        }

        if (!this.conversationAgent.canGroupReceiveResponse(groupId)) {
          console.log('📨 MessageAgent: Group rate limited:', groupId);
          return;
        }
      }

      // First check for specific inquiries
      console.log('📨 MessageAgent: Checking for specific inquiries');
      if (this.inquiryAgent.isMerchInquiry(messageText)) {
        const response = this.inquiryAgent.handleMerchInquiry();
        await ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
        return;
      }

      if (this.inquiryAgent.isSocialInquiry(messageText)) {
        const response = this.inquiryAgent.handleSocialInquiry();
        await ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
        return;
      }

      // Check if it's an artist-related query
      if (this.isArtistQuery(messageText)) {
        console.log('📨 MessageAgent: Handling artist query');
        const response = await this.databaseAgent.processArtistQuery(messageText);
        await ctx.reply(response, { reply_to_message_id: ctx.message?.message_id });
        return;
      }

      // Handle regular conversation if it's a mention/reply or random response
      if (isMentioned || isReplyToBot) {
        console.log('📨 MessageAgent: Handling direct mention/reply');
        await this.handleDirectMention(ctx);
      } else if (this.shouldRespond()) {
        console.log('📨 MessageAgent: Handling random group message');
        await this.handleGroupMessage(ctx);
      }
    } catch (error) {
      console.error('📨 MessageAgent: Error handling message:', error);
      try {
        await ctx.reply('Alamak, ada something wrong ni 😅 Try again later k?');
      } catch (replyError) {
        console.error('📨 MessageAgent: Could not send error message:', replyError);
      }
    }
  }

  private shouldRespond(): boolean {
    const config = this.coreAgent.getConfig();
    return Math.random() < config.responseThreshold;
  }

  private async handleDirectMention(ctx: Context): Promise<void> {
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
    if (!groupId || !messageText) return;

    // Update conversation history
    this.conversationAgent.updateHistory(groupId, {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    });

    try {
      console.log('📨 MessageAgent: Generating response for direct mention');
      const response = await this.conversationAgent.generateResponse(groupId);
      
      if (response) {
        // Add some human-like delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        await ctx.reply(response, {
          reply_to_message_id: ctx.message?.message_id,
          disable_web_page_preview: true
        } as any);

        // Update history with bot's response
        this.conversationAgent.updateHistory(groupId, {
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        });

        console.log('📨 MessageAgent: Sent response to direct mention');
      }
    } catch (error) {
      console.error('📨 MessageAgent: Error in mention handler:', error);
      throw error;
    }
  }

  private async handleGroupMessage(ctx: Context): Promise<void> {
    const groupId = ctx.chat?.id.toString();
    const messageText = ctx.message?.text;
    
    if (!groupId || !messageText) return;

    // Update conversation history
    this.conversationAgent.updateHistory(groupId, {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    });

    try {
      const response = await this.conversationAgent.generateResponse(groupId);
      
      if (response) {
        // Add some human-like delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        await ctx.reply(response, {
          disable_web_page_preview: true
        } as any);

        // Update history with bot's response
        this.conversationAgent.updateHistory(groupId, {
          role: 'assistant',
          content: response,
          timestamp: Date.now()
        });

        console.log('📨 MessageAgent: Sent response to group message');
      }
    } catch (error) {
      console.error('📨 MessageAgent: Error generating response:', error);
    }
  }
} 
  
