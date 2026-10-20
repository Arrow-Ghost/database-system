# Deploying the Module 5 site

```
Browser ──► Vercel (Astro site, static) ──fetch──► Render (Node API, /server) ──► MongoDB Atlas (free M0)
```

- **Vercel** serves the website: the scroll story, WebGL, and the quiz screens.
- **Render** runs the small leaderboard API in `server/`. It checks each player's answers, works out the score, and returns the ranked list.
- **MongoDB Atlas** stores the scores. Render's free plan has an ephemeral disk: files are wiped on every restart or spin-down, so the scores need a real database. A document database behind a NoSQL quiz is also a nice live example for the class.

Order matters: **Atlas → Render → Vercel → lock CORS on Render.**

---

## 0. Push the code to GitHub

```bash
cd module5-dbs
git init
git add .
git commit -m "Module 5 site"
git branch -M main
git remote add origin https://github.com/<your-username>/module5-dbs.git
git push -u origin main
```

`.gitignore` already leaves out `node_modules`, `dist` and `.env` files.

---

## 1. MongoDB Atlas (free database)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster:**

   | Field | Value |
   |---|---|
   | Plan | **M0 (Free)** |
   | Provider | AWS |
   | Region | **Singapore (ap-southeast-1)** if offered, otherwise **Mumbai (ap-south-1)** |
   | Cluster name | `Cluster0` (default is fine) |

3. **Database user** (Security → Database Access → Add New Database User):

   | Field | Value |
   |---|---|
   | Authentication | Password |
   | Username | `quizapi` |
   | Password | Click *Autogenerate*, then copy it somewhere safe |
   | Built-in role | *Read and write to any database* |

4. **Network Access** (Security → Network Access → Add IP Address): enter **`0.0.0.0/0`** (allow from anywhere). Render's free plan has no fixed outgoing IP, so Atlas has to accept any IP. The password still protects the database.
5. **Connection string:** go to Database → **Connect** → **Drivers** → Node.js and copy the URI. Put your password in place of `<db_password>`:

   ```
   mongodb+srv://quizapi:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

   If the password contains `@ : / ? # %`, URL-encode it, or regenerate a password with letters and digits only.

The API creates the database `module5_site` and the collection `quiz_scores` on the first score.

---

## 2. Render (backend API)

Dashboard → **New +** → **Web Service** → connect your GitHub account → pick the `module5-dbs` repo.

| Form field | What to enter |
|---|---|
| **Name** | `dbs-module5-api` (your URL becomes `https://dbs-module5-api.onrender.com`; Render adds a suffix if the name is taken) |
| **Project / Environment** | Leave empty or pick any |
| **Language** | `Node` |
| **Branch** | `main` |
| **Region** | `Singapore (Southeast Asia)` |
| **Root Directory** | `server` |
| **Build Command** | `npm ci` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

**Environment Variables** (on the same page, "Add Environment Variable"):

| Key | Value |
|---|---|
| `MONGODB_URI` | The Atlas connection string from step 1.5 |
| `NODE_VERSION` | `20` |
| `DB_NAME` | `module5_site` *(optional, this is the default)* |
| `ALLOWED_ORIGINS` | Leave this out for now; you add it in step 4 |

**Advanced** (expand it):

| Field | Value |
|---|---|
| **Health Check Path** | `/health` |
| **Auto-Deploy** | `On Commit` |

Click **Deploy Web Service**. When the log says `Connected to MongoDB`, open:

- `https://dbs-module5-api.onrender.com/health` should show `{"ok":true,"storage":"mongodb"}`
- `https://dbs-module5-api.onrender.com/api/scores` should show `{"scores":[],"total":0}`

If `/health` shows `"storage":"memory"`, `MONGODB_URI` is missing. If it shows `"connecting"`, the URI or the Atlas network rule is wrong; check the Render logs.

*Shortcut:* instead of filling the form, use **New + → Blueprint** with the included `render.yaml`. Render then asks you only for `MONGODB_URI` and `ALLOWED_ORIGINS`.

---

## 3. Vercel (frontend)

Dashboard → **Add New…** → **Project** → import the same GitHub repo.

| Form field | What to enter |
|---|---|
| **Project Name** | `module5-dbs` (your site becomes `https://module5-dbs.vercel.app`) |
| **Framework Preset** | `Astro` (detected automatically) |
| **Root Directory** | `./` (leave as is; do **not** pick `server`) |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |
| **Install Command** | `npm install` (default) |

**Environment Variables:**

| Key | Value | Environments |
|---|---|---|
| `PUBLIC_API_URL` | `https://dbs-module5-api.onrender.com` (your Render URL, no trailing slash) | Production, Preview, Development |

Click **Deploy**.

`PUBLIC_API_URL` is baked in when the site builds. If you change it later, go to Deployments → latest → **⋯ → Redeploy**.

---

## 4. Lock the API to your site (CORS)

Back in Render → your service → **Environment** → add:

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://module5-dbs.vercel.app,https://module5-dbs-*.vercel.app` |

Use your real Vercel domain. The `*` entry covers Vercel's preview URLs. Add `,http://localhost:4321` if you also want to test locally. Saving restarts the service.

Until `ALLOWED_ORIGINS` is set, the API accepts requests from any site, which is handy while testing.

---

## 5. Before class

- **Wake the server first.** Render's free plan spins the service down after 15 minutes without traffic, and spinning back up takes about a minute. Open `https://dbs-module5-api.onrender.com/health` two minutes before you start. The website also pings the API as soon as it loads, and the open leaderboard checks for new scores every few seconds, so it stays awake during the talk.
- **Clear rehearsal scores.** In Atlas → Database → **Browse Collections** → `module5_site` → `quiz_scores`, delete the test documents. You can also delete the whole collection; it is recreated on the next score.
- **If the API is down,** the quiz still works. Scores are saved in the player's browser and upload automatically once the server is reachable again.

---

## How the quiz talks to the API

| Endpoint | What it does |
|---|---|
| `GET /health` | Wake-up and status check |
| `GET /api/scores?limit=100` | Top scores, sorted by score (high first), then time (fast first) |
| `POST /api/scores` | Body `{ id, name, answers: [12 numbers 0–3], timeMs }`. The server works out the score from the answer key, so nobody can post a fake 12/12. Duplicate `id`s are ignored, so retries are safe. Limit: 8 posts per minute per IP. |

If you change the quiz questions or their correct answers, update both:
- `Q` in `src/scripts/widgets.ts`
- `ANSWER_KEY` in `server/src/index.js`

---

## Run everything locally

```bash
# terminal 1: API (scores in memory unless MONGODB_URI is set)
cd server && npm install && npm run dev      # http://localhost:8080

# terminal 2: site
npm install
PUBLIC_API_URL=http://localhost:8080 npm run dev   # http://localhost:4321
```

On Windows PowerShell, use `$env:PUBLIC_API_URL="http://localhost:8080"; npm run dev`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Leaderboard shows "Waking the score server…" for over a minute | Open the Render URL `/health`. Check the Render logs for MongoDB errors. |
| Browser console says *blocked by CORS policy* | `ALLOWED_ORIGINS` doesn't exactly match your Vercel URL (https, no trailing slash). |
| Badge says **This device** instead of **Live · shared** | `PUBLIC_API_URL` wasn't set when Vercel built the site. Set it and redeploy. |
| Render log: `bad auth` | Wrong Atlas username or password in `MONGODB_URI`. |
| Render log: `Server selection timed out` | Atlas Network Access is missing `0.0.0.0/0`. |
