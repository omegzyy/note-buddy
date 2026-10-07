# Note Buddy

A shared clipboard between your laptop and your phone. Paste text, links, screenshots or files on one device and they show up on the other right away.

- Installable app (PWA) for Windows (Edge/Chrome) and Android (Chrome)
- **Ctrl+V anywhere** saves instantly. On the phone, tap **Paste clipboard**.
- Drag & drop files on the laptop
- **Android share sheet**: share from any app → *Note Buddy*
- Real-time sync, pinning, search, one-tap **Copy** (text and images)
- Backed by Supabase (free tier): Postgres + Storage + Realtime + Auth, with row-level security

## 1. Set up Supabase (one time, ~5 min)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   This creates the `notes` table, the private `attachments` storage bucket, the security policies, and turns on realtime.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. In this folder:
   ```bash
   cp .env.example .env
   ```
   Then paste the two values into `.env`.
5. Optional but recommended: in **Authentication → Providers → Email**, turn off *Confirm email*. That lets you sign in right after creating your account.

## 2. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and create your account. After that, go to **Authentication → Providers → Email** and turn off *Allow new users to sign up*, so nobody else can register.

## 3. Deploy (needed for your phone)

To install on the phone and use the clipboard there, the app has to be served over HTTPS. Vercel's free tier works:

1. Push this folder to a GitHub repo.
2. On <https://vercel.com>, choose **Add New → Project**, import the repo (Vite is detected automatically).
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then click **Deploy**.
   If you connected Supabase through Vercel's Supabase integration instead, its `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` variables are picked up automatically.
   Env vars are baked in at build time, so **redeploy** after changing them.
4. In Supabase, open **Authentication → URL Configuration** and set the **Site URL** to your Vercel URL.

Netlify and Cloudflare Pages work too. Use build command `npm run build` and output folder `dist`.

## 4. Install on your devices

- **Android:** open your deployed URL in Chrome, then ⋮ → **Add to Home screen / Install app**. After installing, *Note Buddy* appears in the share sheet.
- **Windows:** open the URL in Edge or Chrome and click the install icon in the address bar. You can pin it to the taskbar.

## How to use

| You want to… | Laptop | Phone |
| --- | --- | --- |
| Send clipboard | Ctrl+V anywhere in the app | **Paste clipboard** button |
| Send a file | Drag & drop, or **Add file** | **Add file**, or share from Gallery/Files |
| Send from another app | — | Share → Note Buddy |
| Get it back | **Copy** / ⬇ on the card | **Copy** / ⬇ on the card |
| Type a note | Type in the box, **Ctrl+Enter** to save | Type, then **Save text** |

Files can be up to 50 MB each (the Supabase free-tier limit).

## Project layout

```
src/
  App.tsx                 auth gate
  components/Home.tsx     main screen: loading, realtime, paste/drop/share handling
  components/QuickAdd.tsx text box + Paste/Add file buttons
  components/NoteCard.tsx a single note (copy, download, pin, delete)
  lib/notes.ts            Supabase CRUD, uploads, signed URLs, realtime
  lib/clipboard.ts        clipboard read/write helpers
  lib/shared.ts           picks up items from the Android share sheet
  sw.ts                   service worker: offline shell + share-target handler
supabase/schema.sql       database, storage and security setup
```

Run `npm run generate-icons` after editing `public/logo.svg` to regenerate the icons.
