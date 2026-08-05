# CoconutBoats setup

1. Open the CoconutBoats project in Supabase.
2. Open **SQL Editor**, paste the complete contents of `supabase-schema.sql`, and run it once.
3. Open **Project Settings > Data API** and copy the Project URL and anon/publishable key.
4. Create `.env.local` in this folder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

5. Run:

```bash
npm install
npm run dev
```

The fleet overview and individual vessel pages now read boat information from the Supabase `boats` table. To change a vessel, edit its row in **Table Editor > boats** rather than changing the React code.

The SQL seed records reproduce the six vessels that were hard-coded in the uploaded project. They can be renamed or replaced in Table Editor after setup.
