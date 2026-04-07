# Pattern Rush: Chaos Mode

A procedural cognitive challenge game built with Next.js App Router, Tailwind CSS, and Framer Motion.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase (Optional)

Set the following environment variables to enable cloud sync + leaderboard:

```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Expected tables:
- `profiles` (user_id, level, high_score, brain_score)
- `game_stats` (user_id, accuracy, avg_reaction, total_games)

## Structure
- `src/components/game`: UI + round components
- `src/lib/game`: procedural round engine + adaptive difficulty
- `src/lib/profile.ts`: local persistence + optional Supabase sync
