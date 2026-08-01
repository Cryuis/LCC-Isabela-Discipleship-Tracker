const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'discipleship';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_SALT = process.env.ADMIN_SALT;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let db;
const sessions = new Map();

function verifyPassword(password) {
  if (!ADMIN_SALT || !ADMIN_PASSWORD_HASH) {
    return false;
  }
  const hash = crypto.scryptSync(String(password), ADMIN_SALT, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(ADMIN_PASSWORD_HASH, 'hex'),
  );
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  sessions.set(token, { expiresAt });
  return token;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const session = token ? sessions.get(token) : null;

  if (!session || session.expiresAt < Date.now()) {
    if (token) {
      sessions.delete(token);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  session.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  next();
}

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB');

  const count = await db.collection('people').countDocuments();
  if (count === 0) {
    await db.collection('people').insertMany([
      { id: crypto.randomUUID(), name: 'National Office', discipler: '', role: 'National Office', modules: [] },
      { id: crypto.randomUUID(), name: 'Melchor Cavero', discipler: 'National Office', role: 'Pastor', modules: ['Unleash Your Life'] },
      { id: crypto.randomUUID(), name: 'John Doe', discipler: 'Melchor Cavero', role: 'Disciple', modules: ['First Step'] },
    ]);
    console.log('Seeded initial data');
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && verifyPassword(password)) {
    return res.json({ token: createSession() });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', requireAdmin, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    sessions.delete(token);
  }
  res.json({ ok: true });
});

app.get('/api/me', requireAdmin, (_req, res) => {
  res.json({ username: ADMIN_USERNAME });
});

app.get('/api/people', async (_req, res) => {
  try {
    const people = await db.collection('people').find({}).toArray();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', requireAdmin, async (req, res) => {
  try {
    const { name, discipler, role, modules } = req.body;
    const doc = {
      id: crypto.randomUUID(),
      name,
      discipler: discipler || '',
      role: role || 'Disciple',
      modules: modules || [],
    };
    const result = await db.collection('people').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/people/:id', requireAdmin, async (req, res) => {
  try {
    const { name, discipler, role, modules } = req.body;
    const update = {
      $set: {
        name,
        discipler: discipler || '',
        role: role || 'Disciple',
        modules: modules || [],
      },
    };
    const result = await db
      .collection('people')
      .updateOne({ id: req.params.id }, update);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const person = await db
      .collection('people')
      .findOne({ id: req.params.id });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/people/:id', requireAdmin, async (req, res) => {
  try {
    const person = await db.collection('people').findOne({ id: req.params.id });
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    if (person.name === 'National Office') {
      return res.status(400).json({ error: 'Cannot delete National Office' });
    }

    const result = await db.collection('people').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    await db
      .collection('people')
      .updateMany(
        { discipler: person.name },
        { $set: { discipler: '' } },
      );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
