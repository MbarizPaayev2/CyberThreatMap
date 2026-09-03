# 🌐 Live Cyber Threat Map

A real-time global cyber attack visualization dashboard built with Vanilla JavaScript, Vite, Globe.gl, Chart.js, and Supabase.

## 🏗️ Architecture

- **Frontend**: Vanilla JS (ES6 Modules), HTML5, CSS3, Vite
- **3D Visualization**: Globe.gl (Three.js)
- **Charts**: Chart.js
- **Backend / Real-time**: Supabase (PostgreSQL + Realtime subscriptions)
- **Cron Jobs & APIs**: Vercel Serverless Functions

## 🚀 Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Supabase Setup
1. Create a project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Copy the contents of `supabase/migrations/001_threat_events.sql` and run it. This creates the table, policies, realtime publication, and RPC functions.
4. From your Supabase project settings (API section), get your:
   - `Project URL` -> `VITE_SUPABASE_URL`
   - `anon public key` -> `VITE_SUPABASE_ANON_KEY`
   - `service_role secret` -> `SUPABASE_SERVICE_ROLE_KEY` (KEEP THIS SECRET!)

Update your `.env.local` with these values. Also add a random string for `CRON_SECRET`.

### 4. Run Locally
Start the Vite development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`. 
*(Note: To test backend serverless functions locally, you will need `vercel dev`)*

### 5. Manually Triggering Threat Generation
Since cron jobs don't run automatically in local dev unless simulated, you can manually trigger the data generation by hitting the API endpoint in your browser or via curl:
```bash
curl -H "Authorization: Bearer <YOUR_CRON_SECRET>" http://localhost:3000/api/cron/generate-events
```

## ☁️ Deployment (Vercel)

1. Connect your GitHub repository to Vercel.
2. In the Vercel project settings, add all the environment variables from your `.env.local`.
3. Vercel will automatically read `vercel.json` and set up the cron jobs to run every minute for generating events, and daily for cleaning up old data.
4. Deploy!

## 🔌 Provider Pattern (Extending the Backend)
Currently, the backend uses `MockProvider` to generate fake threat data. To switch to a real API (like AbuseIPDB, Shodan):
1. Create a new provider class in `lib/providers/` extending `ThreatDataProvider`.
2. Update `api/cron/generate-events.js` to instantiate your new provider instead of `MockProvider`.
