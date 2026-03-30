# Socket.IO AI Chat Bot

A real-time, AI-powered chat bot built with Node.js, Express, and Socket.IO. Features a hybrid two-tier response system — instant rule-based answers for common queries and OpenAI GPT-4o streaming for everything else.

## Features

- **Hybrid Intelligence** — Rule-based Tier 1 for math, dates, and small talk; GPT-4o Tier 2 for open-ended conversation
- **Real-Time Streaming** — AI responses stream word-by-word via Socket.IO
- **Multi-User Support** — Live online user count and broadcast messaging
- **Modern Dark UI** — Responsive sidebar layout with quick-prompt buttons and capability reference
- **Error Resilience** — Graceful fallback messages for API key issues and rate limits

## Project Structure

```
SocketIO/
├── Backend/
│   ├── index.js          # Express server + Socket.IO event handling
│   ├── botBrain.js       # Rule engine, bot name, and AI system prompt
│   ├── index.html        # Legacy fallback UI (minimal)
│   ├── .env              # Environment variables (OPENAI_API_KEY)
│   └── package.json
│
└── Frontend/
    ├── index.html        # Main chat UI
    ├── js/
    │   └── app.js        # Socket.IO client + DOM logic
    └── css/
        └── style.css     # Dark theme styling
```

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- An [OpenAI API key](https://platform.openai.com/api-keys) (required for AI responses)

## Setup

1. **Clone the repo and install dependencies**

   ```bash
   cd Backend
   npm install
   ```

2. **Configure your API key**

   Create or edit `Backend/.env`:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Start the server**

   ```bash
   # Production
   npm start

   # Development (auto-reload)
   npm run dev
   ```

4. **Open the chat UI**

   Open `Frontend/index.html` directly in your browser, or navigate to `http://localhost:3345` for the fallback UI.

## How It Works

```
User sends message
    │
    ├─ Tier 1: Rule match found?
    │       └─ Yes → Instant response (600–1000ms simulated delay)
    │
    └─ Tier 2: No rule match
            └─ Calls OpenAI GPT-4o → Streams response chunks in real-time
```

## Built-in Bot Capabilities (Tier 1)

| Category | Examples |
|---|---|
| Greetings & small talk | `hi`, `how are you`, `tell me a joke` |
| Date & time | `what time is it`, `what's today's date` |
| Arithmetic | `what is 12 * 7 + 3` |
| Math functions | `sqrt of 144`, `factorial of 6`, `is 17 prime` |
| Number properties | `is 9 divisible by 3`, `is 8 even`, `gcd of 12 and 18` |
| Comparisons | `is 15 greater than 9` |

Anything outside these rules falls through to GPT-4o.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start server with Node |
| `npm run dev` | Start server with nodemon (auto-reload) |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI) | Your OpenAI API key |

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.IO 4, OpenAI SDK 6, dotenv
- **Frontend:** HTML5, Vanilla JavaScript, CSS3 (no frameworks)
- **AI Model:** GPT-4o (streaming)
