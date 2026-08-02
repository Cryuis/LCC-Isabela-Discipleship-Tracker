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
const PROTECTED_NAMES = ['National Office', 'Melchor Cavero'];

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

  await db.collection('people').deleteMany({ status: 'declined' });

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findDuplicate(database, names, excludeId) {
  const uniqueNames = [];
  const seen = new Set();
  for (const n of names) {
    const key = String(n).toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueNames.push(String(n));
  }

  const filters = uniqueNames.map(
    (n) => new RegExp(`^${escapeRegExp(n)}$`, 'i'),
  );
  const filter = { name: { $in: filters } };
  if (excludeId) {
    filter.id = { $ne: excludeId };
  }
  const existing = await database
    .collection('people')
    .findOne(filter);
  return existing ? existing.name : null;
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

async function approveSubtree(database, rootName, visited = new Set()) {
  if (!rootName || visited.has(rootName)) {
    return;
  }
  visited.add(rootName);

  const children = await database
    .collection('people')
    .find({ discipler: rootName, status: 'pending' })
    .toArray();

  for (const child of children) {
    await database
      .collection('people')
      .updateOne({ id: child.id }, { $set: { status: 'approved' } });
    await approveSubtree(database, child.name, visited);
  }
}

async function deleteSubtree(database, rootId, rootName, visited = new Set()) {
  if (visited.has(rootId)) {
    return;
  }
  visited.add(rootId);

  const children = await database
    .collection('people')
    .find({ discipler: rootName, status: 'pending' })
    .toArray();

  for (const child of children) {
    await deleteSubtree(database, child.id, child.name, visited);
  }

  await database.collection('people').deleteOne({ id: rootId });
}

app.patch('/api/people/:id/status', requireAdmin, async (req, res) => {
  try {
    const database = await getDb();
    const { status } = req.body;
    if (status !== 'approved' && status !== 'declined') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const person = await database
      .collection('people')
      .findOne({ id: req.params.id });
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }
    if (PROTECTED_NAMES.includes(person.name)) {
      return res
        .status(400)
        .json({ error: 'This person cannot be declined or removed' });
    }
    await database
      .collection('people')
      .updateOne({ id: req.params.id }, { $set: { status } });

    if (status === 'approved') {
      await approveSubtree(database, person.name);
    } else if (status === 'declined') {
      await deleteSubtree(database, person.id, person.name);
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
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const duplicate = await findDuplicate(database, [name]);
    if (duplicate) {
      return res.status(409).json({ error: `${duplicate} is already inputted` });
    }
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

app.post('/api/people/batch', async (req, res) => {
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
      disciples = [],
    } = req.body;

    const mainName = String(name || '').trim();
    const discipleNames = (Array.isArray(disciples) ? disciples : [])
      .map((n) => String(n || '').trim())
      .filter(Boolean);

    if (!mainName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const lowerNames = new Set([mainName.toLowerCase()]);
    for (const discipleName of discipleNames) {
      const key = discipleName.toLowerCase();
      if (lowerNames.has(key)) {
        return res.status(409).json({ error: `${discipleName} is already inputted` });
      }
      lowerNames.add(key);
    }

    const duplicate = await findDuplicate(
      database,
      [mainName, ...discipleNames],
    );
    if (duplicate) {
      return res.status(409).json({ error: `${duplicate} is already inputted` });
    }

    const mainDoc = {
      id: crypto.randomUUID(),
      name: mainName,
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
      status: 'pending',
    };
    await database.collection('people').insertOne(mainDoc);

    for (const discipleName of discipleNames) {
      await database.collection('people').insertOne({
        id: crypto.randomUUID(),
        name: discipleName,
        address: '',
        bday: '',
        age: '',
        civilStatus: '',
        mobileNumber: '',
        lccFileNo: '',
        series: '',
        discipler: mainName,
        role: 'Disciple',
        modules: {},
        status: 'pending',
      });
    }

    res.status(201).json({ ...mainDoc });
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
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const duplicate = await findDuplicate(database, [name], req.params.id);
    if (duplicate) {
      return res.status(409).json({ error: `${duplicate} is already inputted` });
    }
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
    if (PROTECTED_NAMES.includes(person.name)) {
      return res.status(400).json({ error: 'Cannot delete this person' });
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
