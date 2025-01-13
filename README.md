# Malaysian Group Chat Bot 🇲🇾

A Telegram bot that chats in casual Malaysian style (bahasa pasar) and helps manage group chats. The bot responds naturally to conversations, creates polls, helps with group moderation, and provides information about SLATAN artists and their catalogs.

## Features 🌟

### Chat Features
- Responds in casual Malaysian style (bahasa pasar/slang)
- Uses Malaysian expressions and particles (lah, kan, eh)
- Mixes English and Malay naturally
- Responds to direct mentions (@slatanadmin_internbot)
- Joins random conversations (configurable frequency)

### Artist Catalog Features 🎵
- Search for artist information and tracks
- View artist's latest releases and projects
- Get track details (language, duration, links)
- Check upcoming shows featuring artists
- View project collaborations and status
- Real-time data from Supabase database

### Group Management
- `/poll` - Create quick polls for group decisions
- `/kick` - Start a voting poll to kick users (admin only)
  - Poll lasts for 5 minutes
  - User is kicked if >50% vote to kick
  - Only admins can initiate kick votes
  - Anonymous voting is disabled
- Rate limiting to prevent spam
- Automatic conversation management

## Setup 🛠️

### Prerequisites
- Node.js 18.x
- npm 9.x or higher
- A Telegram Bot Token (from @BotFather)
- OpenAI API Key
- Supabase Project (for database)

### Local Development
1. Clone the repository:
```bash
git clone [your-repo-url]
cd telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
TELEGRAM_TOKEN=your_telegram_bot_token
OPENAI_API_KEY=your_openai_api_key
GROUP_IDS=your_group_id
RESPONSE_THRESHOLD=0.7
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run in development mode:
```bash
npm run dev
```

### Database Setup
1. Create a Supabase project
2. Set up the following tables:
   - `catalogs`: Artist tracks and releases
   - `shows`: Performance events
   - `projects`: Current and upcoming releases

### Deployment to Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables:
   - `TELEGRAM_TOKEN`
   - `OPENAI_API_KEY`
   - `GROUP_IDS`
   - `RESPONSE_THRESHOLD`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT=3000`
4. Use Docker deployment settings

## Bot Commands and Features 🤖

### Basic Commands
- `/poll [question]` - Create a poll
  ```
  Example: /poll Nak makan apa?
  ```

- `/kick` - Start a kick vote (admin only)
  ```
  Usage: Reply to a message with /kick
  ```

### Artist Catalog Queries
The bot understands various ways to ask about artists:
```
- "tell me about [artist]"
- "check songs by [artist]"
- "tengok lagu [artist]"
- "cari tracks [artist]"
```

Example responses:
```
You: tell me about Quai
Bot: Eh bestie! Quai ada banyak lagu tau 🎵 Latest track dia 'ALPHA' (Malay, 2'05") - boleh dengar kat Apple Music! Ada lagi 'YUNG MALAY' & 'ART BRATZ' 🔥

You: check songs by JAYSTATION
Bot: JAYSTATION punya catalog lit gila bestie! 🔥 Latest releases: 'PRAY FOR ME' (3:14) & 'GROCERY RUN' (2:39) - both ada kat YouTube!
```

## Configuration ⚙️

### Environment Variables
- `TELEGRAM_TOKEN`: Your Telegram bot token
- `OPENAI_API_KEY`: Your OpenAI API key
- `GROUP_IDS`: Comma-separated list of allowed group IDs
- `RESPONSE_THRESHOLD`: Number between 0-1 (e.g., 0.7 = 70% chance to respond)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Response Threshold
- 0.0 = Never responds to random messages
- 0.3 = Responds to 30% of messages
- 0.7 = Responds to 70% of messages
- 1.0 = Responds to all messages

## Bot Setup in Telegram

1. Message @BotFather to create a new bot
2. Set bot commands:
```
poll - Buat poll untuk group chat 📊
kick - Reply message user yang nak kick 🚫
help - Tunjuk semua commands dan cara guna bot 🤖
```

3. Add bot to your group
4. Make bot admin with these permissions:
   - Delete messages
   - Ban users
   - Pin messages

## Rate Limiting 🚦

- User cooldown: 1 minute between messages
- Group cooldown: 10 seconds between bot responses
- Exception: Direct mentions always get a response

## Development 👨‍💻

### Project Structure
```
├── telegram-bot.ts    # Main bot code
├── package.json       # Dependencies
├── tsconfig.json     # TypeScript config
├── Dockerfile        # Docker configuration
└── .env             # Environment variables
```

### Building
```bash
npm run build
```

### Running
```bash
npm start    # Production
npm run dev  # Development
```

## Contributing 🤝

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License 📝

MIT License 