# ScriptMentor AI

ScriptMentor AI is an advanced screenplay feedback application that provides AI-powered analysis and suggestions for screenwriters. The application uses AI mentors inspired by industry professionals to give detailed, personalized feedback on screenplay content.

## Features

- **AI Mentor Feedback**: Get feedback from different mentor personas with unique analysis styles
- **Script Analysis**: Upload and analyze screenplays in various formats (FDX, Fountain, TXT)
- **Chunked Analysis**: Process large scripts in manageable sections
- **Blended Feedback**: Combine insights from multiple mentors
- **Writer Suggestions**: Receive specific rewrite suggestions based on feedback
- **Script Library**: Save and manage your screenplay projects
- **Character Memory**: Track character development and traits across scenes
- **Client-side Encryption**: Protect your screenplay content with local encryption

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: OpenAI API (via proxy service)
- **Payments**: Stripe integration

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your API keys
4. Run the development server: `npm run dev`

## Environment Variables

Create a `.env` file with the following variables:

```
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here

# Backend API Configuration
VITE_BACKEND_API_URL=https://smbackend-production.up.railway.app/api

# Environment
NODE_ENV=development
```

## Supabase Setup

1. Create a Supabase project
2. Run the migrations in the `supabase/migrations` folder
3. Set up authentication (Email/Password)
4. Configure storage buckets if needed

## Stripe Integration

1. Create a Stripe account
2. Set up products and prices matching the configuration in `src/stripe-config.ts`
3. Deploy the Supabase Edge Functions for Stripe integration
4. Set the webhook endpoint in your Stripe dashboard

## License

This project is proprietary and confidential.