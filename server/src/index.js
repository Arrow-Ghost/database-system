// Leaderboard API for the Module 5 (Distributed and NoSQL Databases) site.
// Runs on Render; stores scores in MongoDB Atlas (a NoSQL document store).
// Without MONGODB_URI it keeps scores in memory, which is fine for local testing.

import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const PORT = Number(process.env.PORT) || 8080;
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'module5_site';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

// Correct option index for each of the 12 questions. Keep in sync with Q in src/scripts/widgets.ts.
const ANSWER_KEY = [1, 0, 1, 2, 1, 1, 1, 0, 2, 3, 1, 3];
const OPTIONS_PER_QUESTION = 4;

/* ---------------- storage ---------------- */
const memory = [];
let scores = null; // MongoDB collection once connected

async function connectMongo() {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI not set: scores are kept in memory and vanish on restart.');
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 });
      await client.connect();
      scores = client.db(DB_NAME).collection('quiz_scores');
      await scores.createIndex({ score: -1, timeMs: 1, at: 1 });
      console.log(`Connected to MongoDB (${DB_NAME}.quiz_scores)`);
      return;
    } catch (err) {
      const wait = Math.min(30000, attempt * 3000);
      console.error(`MongoDB connection failed (attempt ${attempt}): ${err.message}. Retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

const better = (a, b) => b.score - a.score || a.timeMs - b.timeMs || a.at.localeCompare(b.at);
const publicEntry = (d) => ({ id: d._id, name: d.name, score: d.score, total: d.total, timeMs: d.timeMs, answers: d.answers, at: d.at });

async function listScores(limit) {
  if (scores) {
    const [docs, total] = await Promise.all([
      scores.find({}).sort({ score: -1, timeMs: 1, at: 1 }).limit(limit).toArray(),
      scores.estimatedDocumentCount(),
    ]);
    return { scores: docs.map(publicEntry), total };
  }
  if (MONGODB_URI) throw Object.assign(new Error('Database is still connecting'), { status: 503 });
  return { scores: memory.slice().sort(better).slice(0, limit).map(publicEntry), total: memory.length };
}

async function insertScore(doc) {
  if (scores) {
    try {
      await scores.insertOne(doc);
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = duplicate id: a retried submission, keep the first copy
      doc = await scores.findOne({ _id: doc._id });
    }
    const ahead = await scores.countDocuments({
      $or: [{ score: { $gt: doc.score } }, { score: doc.score, timeMs: { $lt: doc.timeMs } }],
    });
    return { entry: publicEntry(doc), rank: ahead + 1, total: await scores.estimatedDocumentCount() };
  }
  if (MONGODB_URI) throw Object.assign(new Error('Database is still connecting'), { status: 503 });
  const existing = memory.find((d) => d._id === doc._id);
  if (existing) doc = existing; else memory.push(doc);
  const ahead = memory.filter((d) => d.score > doc.score || (d.score === doc.score && d.timeMs < doc.timeMs)).length;
  return { entry: publicEntry(doc), rank: ahead + 1, total: memory.length };
}

/* ---------------- validation ---------------- */
function cleanName(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}
function validate(body) {
  const name = cleanName(body?.name);
  if (!name) return { error: 'name is required (1 to 24 characters)' };
  const answers = body?.answers;
  if (!Array.isArray(answers) || answers.length !== ANSWER_KEY.length) return { error: `answers must list ${ANSWER_KEY.length} choices` };
  if (!answers.every((a) => Number.isInteger(a) && a >= 0 && a < OPTIONS_PER_QUESTION)) return { error: 'each answer must be 0, 1, 2 or 3' };
  const timeMs = Math.round(Number(body?.timeMs));
  if (!Number.isFinite(timeMs) || timeMs < 1000 || timeMs > 60 * 60 * 1000) return { error: 'timeMs must be between 1 second and 1 hour' };
  const id = typeof body?.id === 'string' && /^[A-Za-z0-9_-]{6,48}$/.test(body.id) ? body.id : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // The server scores the answers itself, so a player cannot post a fake score.
  const score = answers.reduce((n, a, i) => n + (a === ANSWER_KEY[i] ? 1 : 0), 0);
  return { doc: { _id: id, name, answers, score, total: ANSWER_KEY.length, timeMs, at: new Date().toISOString() } };
}

/* ---------------- rate limit: 8 submissions per IP per minute ---------------- */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 8;
}

/* ---------------- app ---------------- */
const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; this gives the real client IP
app.disable('x-powered-by');

const originAllowed = (origin) => {
  if (!origin || !ALLOWED.length) return true; // no list set: allow everyone (simplest for a class demo)
  return ALLOWED.some((rule) => {
    if (rule === '*') return true;
    if (rule.includes('*')) return new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+') + '$').test(origin);
    return rule === origin;
  });
};
app.use(cors({ origin: (origin, cb) => cb(null, originAllowed(origin)), methods: ['GET', 'POST'], maxAge: 86400 }));
app.use(express.json({ limit: '4kb' }));
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/', (_req, res) => res.type('text').send('Module 5 quiz API. Try GET /api/scores'));
app.get('/health', (_req, res) => res.json({ ok: true, storage: scores ? 'mongodb' : MONGODB_URI ? 'connecting' : 'memory' }));

app.get('/api/scores', async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  try {
    res.json(await listScores(limit));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load scores' });
  }
});

app.post('/api/scores', async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many submissions, wait a minute' });
  const { error, doc } = validate(req.body);
  if (error) return res.status(400).json({ error });
  try {
    res.status(201).json(await insertScore(doc));
  } catch (err) {
    console.error('insert failed:', err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save score' });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`Quiz API listening on ${PORT}`));
connectMongo();
