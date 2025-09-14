# SpeakPoly - Language Exchange Platform

A safe, global platform for learning languages through real conversations with native speakers.

## Features

- **Strict Native-to-Learner Matching**: Connect only with native speakers learning your language
- **Real-time Chat**: Text, voice notes, and audio calls
- **AI-Powered Learning**: Topic suggestions and session summaries
- **Safety First**: Contact information redaction and content moderation
- **Progress Tracking**: Monitor your language learning journey

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, Prisma, PostgreSQL
- **Real-time**: Socket.io, WebRTC
- **AI**: OpenAI API
- **Infrastructure**: Vercel/Railway, Redis, S3/R2

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (optional for development)

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your configuration
3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up the database:
   ```bash
   npm run db:push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
speakpoly/
├── web/                # Next.js application
├── packages/
│   ├── database/      # Prisma schema and client
│   ├── ui/           # Shared UI components
│   ├── types/        # TypeScript types
│   ├── utils/        # Utility functions
│   └── config/       # Configuration
└── services/         # Microservices (future)
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Type checking
npm run typecheck

# Database management
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
```

## License

Private - All rights reserved