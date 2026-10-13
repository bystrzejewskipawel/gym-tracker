# Gym Tracker

A full-stack app for tracking gym workouts: manually-entered exercises,
sessions made of exercises, exercises made of sets, sets made of reps +
weight, inline "what did I do last time?" history, per-account login,
saved routines, and progress charts.

**Stack:** React (Vite) frontend, Node.js/Express API, MongoDB Atlas (free
tier) as the multi-device database, JWT-based auth.

## Project layout

```
gym-tracker/
  backend/    Express API + Mongoose models
  frontend/   React app (Vite)
  render.yaml Render blueprint for one-click backend deploy
```

## Features

- **Accounts** — email/password signup and login (JWT). All exercises,
  sessions, and routines are scoped to the logged-in user.
- **Exercises** — add manually, e.g. "Bench Press" / category "Push".
- **Sessions** — pick exercises (or load a whole routine at once), log
  reps + weight per set. While building a session, each exercise shows
  your most recent result for it.
- **Routines** — save a named group of exercises (e.g. "Push Day") to add
  them to a session in one tap instead of picking one by one.
- **History** — browse past sessions, optionally filtered to one exercise.
- **Progress** — a chart (max weight and total volume per session over
  time) for any exercise.
### Live session tracking (v2)

- **Dark, mobile-first UI** with a bottom tab bar.
- **Drag & drop** the exercise order (grab the ⋮⋮ handle; works with touch).
- **Active exercise only** is expanded; others show just the title and set progress.
  Tap a title to switch. **Mark exercise done** greys it out (tap to reopen).
- **Sets come from the routine**; use `+ Set` / `− Set` to adjust during the session.
- **Rest timer** starts when you tick a set. Green until the suggested rest is up,
  amber for up to 60 s over, red beyond that.
- **Time per exercise** is tracked while an exercise is open and saved with the session.
- **Prefilled reps/weight** come from the latest record of that exercise, shown in
  grey. Edit a value and it turns white; untouched values are saved as-is when you tick the set.
- **Suggested rest time** per exercise (Exercises tab).
- **Left/right exercises**: tick "One side at a time" and each set gets an L and an R row.
  "3 sets" means 3 per side, interleaved L, R, L, R...
- **Supersets** in routines: tick "superset with next". Order is A1 → B1 → rest → A2 → B2 ...
  The rest timer starts after B (using the longer of the two rest times).

### Editing (v3)

- **Exercises**: edit name, category, suggested rest and left/right. The default rest for new exercises is 180 s
  (existing exercises keep the value they already had; change them with *edit*).
- **Routines**: *edit* loads a routine into the builder (sets, order, supersets), then *Save changes*.
- **Session history**: *edit* lets you change the date, notes, sets (reps/weight/side), time per exercise (`m:ss`),
  remove exercises, or add one. Editing always works on the whole session, even when the list is filtered.
- Renaming an exercise does not rewrite old sessions; a session picks up the new name only when you edit and save it.

Notes: only ticked sets are saved. Superset time is split evenly between the two exercises.
Routines created before v2 are empty after upgrading (the data shape changed), so delete and recreate them.


## 1. Set up the database (MongoDB Atlas — free, accessible from any device)

1. Create a free account at https://www.mongodb.com/cloud/atlas/register
2. Create a free (M0) cluster.
3. Under "Database Access", create a user with a password.
4. Under "Network Access", add `0.0.0.0/0` (allow from anywhere) for the prototype —
   tighten this later.
5. Click "Connect" → "Drivers" and copy the connection string. It looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`

This is what makes the data available from multiple devices: any device
that can reach the API server reaches the same shared database.

## 2. Run the backend

```bash
cd backend
cp .env.example .env
# edit .env: paste your MONGO_URI, set a JWT_SECRET (any long random string)
npm install
npm run dev
```

Generate a decent JWT secret with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API starts on `http://localhost:5000`. Check `http://localhost:5000/api/health`.

## 3. Run the frontend

```bash
cd frontend
cp .env.example .env
# .env already defaults to http://localhost:5000/api, edit if needed
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`) and sign up for an account.

### Testing from your phone (same Wi-Fi)

Vite is configured with `host: true`, so it's reachable on your LAN.

1. Find your computer's LAN IP (e.g. `192.168.1.23`).
2. On your phone, open `http://192.168.1.23:5173`.
3. In `frontend/.env`, set `VITE_API_URL=http://192.168.1.23:5000/api` and
   restart `npm run dev` so the phone can reach the API too.

## 4. Push to GitHub

```bash
cd gym-tracker
git init
git add .
git commit -m "Initial gym tracker prototype"
gh repo create gym-tracker --private --source=. --push
# or: create a repo on github.com, then
# git remote add origin <your-repo-url>
# git push -u origin main
```

`.env` files are already git-ignored, so your DB credentials and JWT secret
won't be committed.

## 5. Deploy for real multi-device use

Running two local dev servers only works while your laptop is on and both
devices share Wi-Fi. For anywhere-access, deploy the two halves separately:

### Backend → Render

1. Push this repo to GitHub (step 4).
2. On https://render.com, "New +" → "Blueprint", point it at your repo.
   Render will read `render.yaml` and create the `gym-tracker-api` service
   (root directory `backend`) automatically.
3. In the service's Environment settings, set:
   - `MONGO_URI` — your Atlas connection string
   - `FRONTEND_URL` — leave blank for now, you'll fill this in after step below
   - `JWT_SECRET` is auto-generated by the blueprint
4. Deploy. Note the resulting URL, e.g. `https://gym-tracker-api.onrender.com`.

(No `render.yaml`? You can also just create a Web Service manually with root
directory `backend`, build command `npm install`, start command `npm start`.)

### Frontend → Vercel

1. On https://vercel.com, "New Project", import the same GitHub repo.
2. Set "Root Directory" to `frontend` (Vercel auto-detects Vite).
3. Add an environment variable `VITE_API_URL` = `https://gym-tracker-api.onrender.com/api`
   (your Render URL + `/api`).
4. Deploy. Note the resulting URL, e.g. `https://gym-tracker.vercel.app`.

### Wire them together

Go back to Render, set the backend's `FRONTEND_URL` env var to your Vercel
URL (e.g. `https://gym-tracker.vercel.app`), and redeploy. This locks CORS
down to only your frontend instead of allowing any origin.

Now the same app + data is reachable from your phone, laptop, or anyone
else's device — just by opening the Vercel URL and logging in.

## Importing existing progress from a spreadsheet

A one-off importer reads a CSV export of your sheet and adds it to your account **through the API**
(so it works against the deployed Render backend, or a local one). The data ends up in MongoDB Atlas,
Render only hosts the API in front of it.

1. Export the sheet: *File > Download > Comma-separated values (.csv)*.
2. Put the file in `backend/scripts/data/` (CSV files there are git-ignored, so your data is not committed).
3. **Dry run** (default; offline, nothing is written):
   ```bash
   cd backend
   node scripts/import-sheet.js scripts/data/gym.csv
   ```
   Check the list of sessions and exercises, the exercises marked `[one-sided]`, and the warnings.
   Fix anything in the CSV and repeat until it looks right.
4. **Import for real** (use the same email/password as in the app):
   ```bash
   # macOS / Linux
   API_URL=https://your-api.onrender.com GYM_EMAIL=you@example.com GYM_PASSWORD='your password' \
     node scripts/import-sheet.js scripts/data/gym.csv --commit
   ```
   ```powershell
   # Windows PowerShell
   $env:API_URL="https://your-api.onrender.com"; $env:GYM_EMAIL="you@example.com"; $env:GYM_PASSWORD="your password"
   node scripts/import-sheet.js scripts/data/gym.csv --commit
   ```
   The first call can take up to a minute if the free Render service is asleep.

How rows are read: one row = one exercise on one date; each `seria`/`set` column is a set (empty = not done).
Sessions are created per date (dated at noon, no duration). The muscle column becomes the exercise category.
Exercises are matched by name, so existing ones are reused. A muscle label containing left/right (or
`lewy`/`prawy`, or a `side` column) makes the exercise one-sided and merges both sides into one entry with
L/R sets. Weights: `50kg` is 50, `2x18kg` is 18 (per dumbbell), a negative number such as `-32` is assistance,
an empty weight is 0, `(30kg)12` / `12(60kg)` set the weight for that one set, `12+` is read as 12, and text such as
`(1 pulley)` goes to the session notes. Slash dates are read as month/day (add `--dmy` for day/month).
Re-running is safe: dates that were already imported are skipped. New exercises get the default rest time (180 s).

Negative weights are supported everywhere in the app for assisted exercises: -27 beats -32, and the Progress
chart rises as the assistance drops (volume is hidden for those exercises).

## How the data model works

- **User**: `{ email, passwordHash }`.
- **Exercise**: `{ user, name, category }` — entered manually via the "Exercises" tab.
- **Routine**: `{ user, name, exercises: [Exercise refs] }` — a saved template.
- **Session**: `{ user, date, notes, exercises: [...] }` — a single workout.
- Each entry in a session's `exercises` array is:
  `{ exercise (ref), exerciseName, sets: [{ reps, weight }] }`.
- `GET /api/exercises/:id/history` returns every past session (for the
  logged-in user) that included that exercise, most recent first — this
  powers both the "Last time: 3x10 @ 40kg" hint and the Progress chart.

## API summary

All routes except `/api/auth/*` require `Authorization: Bearer <token>`.

| Method | Route                        | Purpose                            |
|--------|-------------------------------|--------------------------------------|
| POST   | /api/auth/register            | create account, returns token        |
| POST   | /api/auth/login                | log in, returns token                |
| GET    | /api/exercises                 | list your exercises                  |
| POST   | /api/exercises                 | create exercise                      |
| PATCH  | /api/exercises/:id             | edit name / rest time / left-right / category |
| DELETE | /api/exercises/:id             | delete exercise                      |
| GET    | /api/exercises/:id/history      | past sets for one exercise           |
| GET    | /api/routines                   | list your routines                   |
| POST   | /api/routines                   | create routine                       |
| PUT    | /api/routines/:id               | edit routine (name, items)           |
| DELETE | /api/routines/:id               | delete routine                       |
| GET    | /api/sessions                   | list sessions (most recent first)    |
| POST   | /api/sessions                   | create session                       |
| GET    | /api/sessions/:id                | get one session                      |
| PUT    | /api/sessions/:id                | edit session (date, notes, exercises) |
| DELETE | /api/sessions/:id                | delete session                       |

## What to extend next

1. **Password reset / email verification** — there's currently no way to
   recover a forgotten password.
2. **Estimated 1RM** — add an Epley/Brzycki formula alongside max weight
   and volume in the Progress chart.
3. **Edit past sessions** — currently sessions can only be created or
   deleted, not edited after the fact.
4. **Offline support** — a service worker + local queue so a session can be
   logged mid-workout with spotty gym wifi, then synced later.
5. **Rate limiting on auth routes** — add something like `express-rate-limit`
   to `/api/auth/login` before this goes anywhere near real users.
