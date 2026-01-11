# Canopticon

Signal monitoring and analysis system built with Next.js 14.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Authentication**: Clerk
- **Icons**: Lucide React

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy the environment variables file:
```bash
cp .env.local.example .env.local
```

3. Fill in your environment variables in `.env.local`:
   - Supabase URL and anon key
   - Clerk publishable key and secret key

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/app/(public)` - Public pages (landing page, signal detail pages)
- `/app/admin` - Protected admin dashboard
- `/lib` - Utility functions (Supabase client, mock data)
- `/types` - TypeScript type definitions

## Features

- Dark mode terminal-style UI
- Signal monitoring and analysis
- Mission control dashboard
- Intake log tracking
- Signal queue management
