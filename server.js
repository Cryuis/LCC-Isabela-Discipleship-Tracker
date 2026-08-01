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
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let db;
let client;

async function getDb() {
  if (db) {
    return db;
  }
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB');
  await seed();
  return db;
}

async function seed() {
  const adminCount = await db.collection('admins').countDocuments();
  if (adminCount === 0 && ADMIN_USERNAME && ADMIN_SALT && ADMIN_PASSWORD_HASH) {
    await db.collection('admins').insertOne({
      username: ADMIN_USERNAME,
      salt: ADMIN_SALT,
      passwordHash: ADMIN_PASSWORD_HASH,
    });
    console.log(`Seeded admin account: ${ADMIN_USERNAME}`);
  }

  await db
    .collection('people')
    .updateMany(
      { status: { $exists: false } },
      { $set: { status: 'approved' } },
    );

  const count = await db.collection('people').countDocuments();
  if (count === 0) {
    await db.collection('people').insertMany([
      {
        id: crypto.randomUUID(),
        name: 'National Office',
        address: '',
        bday: '',
        age: '',
        civilStatus: '',
        mobileNumber: '',
        lccFileNo: '',
        series: '',
        discipler: '',
        role: 'National Office',
        modules: {},
        status: 'approved',
      },
      {
        id: crypto.randomUUID(),
        name: 'Melchor Cavero',
        address: '',
        bday: '',
        age: '',
        civilStatus: '',
        mobileNumber: '',
        lccFileNo: '',
        series: '',
        discipler: 'National Office',
        role: 'Pastor',
        modules: { 'Unleash your Life': { dateStarted: '', dateCompleted: '' } },
        status: 'approved',
      },
      {
        id: crypto.randomUUID(),
        name: 'John Doe',
        address: '',
        bday: '',
        age: '',
        civilStatus: '',
        mobileNumber: '',
        lccFileNo: '',
        series: '',
        discipler: 'Melchor Cavero',
        role: 'Disciple',
        modules: { 'First Step': { dateStarted: '', dateCompleted: '' } },
        status: 'approved',
      },
    ]);
    console.log('Seeded initial data');
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function createSession(username) {
  const issuedAt = Date.now();
  const payload = `${username}.${issuedAt}`;
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

function getSessionUser(token) {
  if (!token) {
    return null;
  }
  const parts = String(token).split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [username, issuedAtStr, signature] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${username}.${issuedAtStr}`)
    .digest('hex');
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_TTL_MS) {
    return null;
  }
  return username;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const username = getSessionUser(token);
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.sessionUser = username;
  next();
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const database = await getDb();
    const admin = await database.collection('admins').findOne({ username });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const hash = hashPassword(password, admin.salt);
    const valid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(admin.passwordHash, 'hex'),
    );
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ token: createSession(admin.username) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAdmin, (req, res) => {
  res.json({ username: req.sessionUser });
});

app.get('/api/people', async (_req, res) => {
  try {
    const database = await getDb();
    const people = await database
      .collection('people')
      .find({ status: 'approved' })
      .toArray();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/people/all', requireAdmin, async (_req, res) => {
  try {
    const database = await getDb();
    const people = await database.collection('people').find({}).toArray();
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/people/:id/status', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const { status } = req.body;
    if (status !== 'approved' && status !== 'declined') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await database
      .collection('people')
      .updateOne({ id: req.params.id }, { $set: { status } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    res.json({ ok: true, id: req.params.id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', async (req, res) => {
  try {
    const database = await getDb();
    const {
      name,
      address,
      bday,
      age,
      civilStatus,
      mobileNumber,
      lccFileNo,
      series,
      discipler,
      role,
      modules,
      status,
    } = req.body;
    const doc = {
      id: crypto.randomUUID(),
      name,
      address: address || '',
      bday: bday || '',
      age: age || '',
      civilStatus: civilStatus || '',
      mobileNumber: mobileNumber || '',
      lccFileNo: lccFileNo || '',
      series: series || '',
      discipler: discipler || '',
      role: role || 'Disciple',
      modules: modules && typeof modules === 'object' ? modules : {},
      status: status === 'approved' || status === 'declined' ? status : 'pending',
    };
    const result = await database.collection('people').insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/people/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const {
      name,
      address,
      bday,
      age,
      civilStatus,
      mobileNumber,
      lccFileNo,
      series,
      discipler,
      role,
      modules,
    } = req.body;
    const update = {
      $set: {
        name,
        address: address || '',
        bday: bday || '',
        age: age || '',
        civilStatus: civilStatus || '',
        mobileNumber: mobileNumber || '',
        lccFileNo: lccFileNo || '',
        series: series || '',
        discipler: discipler || '',
        role: role || 'Disciple',
        modules: modules && typeof modules === 'object' ? modules : {},
      },
    };
    const result = await database
      .collection('people')
      .updateOne({ id: req.params.id }, update);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const person = await database
      .collection('people')
      .findOne({ id: req.params.id });
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/people/:id', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const person = await database.collection('people').findOne({ id: req.params.id });
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    if (person.name === 'National Office') {
      return res.status(400).json({ error: 'Cannot delete National Office' });
    }

    const result = await database.collection('people').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    await database
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

if (require.main === module) {
  getDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
