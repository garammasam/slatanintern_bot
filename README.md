# Malaysian Group Chat Bot 🇲🇾

A Telegram bot that chats in casual Malaysian style (bahasa pasar) and helps manage group chats. The bot responds naturally to conversations, creates polls, and helps with group moderation.

## Features 🌟

### Chat Features
- Responds in casual Malaysian style (bahasa pasar/slang)
- Uses Malaysian expressions and particles (lah, kan, eh)
- Mixes English and Malay naturally
- Responds to direct mentions (@slatanadmin_internbot)
- Joins random conversations (configurable frequency)

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
```

4. Run in development mode:
```bash
npm run dev
```

### Deployment to Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables:
   - `TELEGRAM_TOKEN`
   - `OPENAI_API_KEY`
   - `GROUP_IDS`
   - `RESPONSE_THRESHOLD`
   - `PORT=3000`
4. Use Docker deployment settings

## Bot Commands 🤖

- `/poll [question]` - Create a poll
  ```
  Example: /poll Nak makan apa?
  ```

- `/kick` - Start a kick vote (admin only)
  ```
  Usage: Reply to a message with /kick
  Details:
  - Creates a 5-minute voting poll
  - Needs more than 50% "Yes" votes to kick
  - Only counts votes from active members
  - Shows who voted for transparency
  - Auto-kicks user when poll ends if threshold met
  ```

## Configuration ⚙️

### Environment Variables
- `TELEGRAM_TOKEN`: Your Telegram bot token
- `OPENAI_API_KEY`: Your OpenAI API key
- `GROUP_IDS`: Comma-separated list of allowed group IDs
- `RESPONSE_THRESHOLD`: Number between 0-1 (e.g., 0.7 = 70% chance to respond)

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