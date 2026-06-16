const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'questions.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // Backwards-compat: older files may not have finalJeopardy
  if (!Array.isArray(data.finalJeopardy)) data.finalJeopardy = [];
  return data;
}

const BOARD_VALUES = [100, 200, 300, 400, 500];

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET all categories (for admin)
app.get('/api/categories', (req, res) => {
  const data = readData();
  res.json(data.categories);
});

// GET randomized game.
// Picks 5 categories, then for EACH board value (100-500) chooses one random
// question of that value — guaranteeing exactly one of every value and never
// a duplicate value. With two questions per value in the pool, replays vary.
app.get('/api/game', (req, res) => {
  const data = readData();

  // Only categories that have at least one question for EVERY value are eligible,
  // so every column is guaranteed a full set of $100–$500.
  const eligible = data.categories.filter(cat =>
    BOARD_VALUES.every(v => cat.questions.some(q => q.points === v))
  );

  const selectedCats = shuffle(eligible).slice(0, 5);

  const gameBoard = selectedCats.map(cat => {
    const questions = BOARD_VALUES.map(value => {
      const pool = cat.questions.filter(q => q.points === value);
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      return { ...chosen, answered: false };
    });
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      questions
    };
  });

  // Pick one random Final Jeopardy question, if any have been entered
  let finalJeopardy = null;
  if (data.finalJeopardy.length > 0) {
    finalJeopardy = data.finalJeopardy[Math.floor(Math.random() * data.finalJeopardy.length)];
  }

  res.json({ board: gameBoard, finalJeopardy });
});

// CREATE category
app.post('/api/categories', (req, res) => {
  const data = readData();
  const { name, icon, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const newCat = {
    id: `cat-${uuidv4()}`,
    name,
    icon: icon || '⭐',
    color: color || '#4ECDC4',
    questions: []
  };
  data.categories.push(newCat);
  writeData(data);
  res.status(201).json(newCat);
});

// UPDATE category
app.put('/api/categories/:id', (req, res) => {
  const data = readData();
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });

  const { name, icon, color } = req.body;
  if (name) data.categories[idx].name = name;
  if (icon) data.categories[idx].icon = icon;
  if (color) data.categories[idx].color = color;

  writeData(data);
  res.json(data.categories[idx]);
});

// DELETE category
app.delete('/api/categories/:id', (req, res) => {
  const data = readData();
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });

  data.categories.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ADD question to category
app.post('/api/categories/:id/questions', (req, res) => {
  const data = readData();
  const cat = data.categories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (cat.questions.length >= 10) return res.status(400).json({ error: 'Maximum 10 questions per category' });

  const { question, answer, hint, points } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer are required' });

  const newQ = {
    id: `q-${uuidv4()}`,
    points: points || 100,
    question,
    answer,
    hint: hint || ''
  };
  cat.questions.push(newQ);
  writeData(data);
  res.status(201).json(newQ);
});

// UPDATE question
app.put('/api/questions/:qid', (req, res) => {
  const data = readData();
  for (const cat of data.categories) {
    const qIdx = cat.questions.findIndex(q => q.id === req.params.qid);
    if (qIdx !== -1) {
      const { question, answer, hint, points } = req.body;
      if (question) cat.questions[qIdx].question = question;
      if (answer) cat.questions[qIdx].answer = answer;
      if (hint !== undefined) cat.questions[qIdx].hint = hint;
      if (points) cat.questions[qIdx].points = points;
      writeData(data);
      return res.json(cat.questions[qIdx]);
    }
  }
  res.status(404).json({ error: 'Question not found' });
});

// DELETE question
app.delete('/api/questions/:qid', (req, res) => {
  const data = readData();
  for (const cat of data.categories) {
    const qIdx = cat.questions.findIndex(q => q.id === req.params.qid);
    if (qIdx !== -1) {
      cat.questions.splice(qIdx, 1);
      writeData(data);
      return res.json({ success: true });
    }
  }
  res.status(404).json({ error: 'Question not found' });
});

// ===== FINAL JEOPARDY =====
// GET all final jeopardy questions
app.get('/api/final', (req, res) => {
  res.json(readData().finalJeopardy);
});

// ADD final jeopardy question (max 5)
app.post('/api/final', (req, res) => {
  const data = readData();
  if (data.finalJeopardy.length >= 5) return res.status(400).json({ error: 'Maximum 5 Final Jeopardy questions' });

  const { question, answer, hint, category } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer are required' });

  const newQ = {
    id: `fj-${uuidv4()}`,
    category: category || 'Final Jeopardy',
    question,
    answer,
    hint: hint || ''
  };
  data.finalJeopardy.push(newQ);
  writeData(data);
  res.status(201).json(newQ);
});

// UPDATE final jeopardy question
app.put('/api/final/:id', (req, res) => {
  const data = readData();
  const idx = data.finalJeopardy.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  const { question, answer, hint, category } = req.body;
  if (question) data.finalJeopardy[idx].question = question;
  if (answer) data.finalJeopardy[idx].answer = answer;
  if (hint !== undefined) data.finalJeopardy[idx].hint = hint;
  if (category !== undefined) data.finalJeopardy[idx].category = category;

  writeData(data);
  res.json(data.finalJeopardy[idx]);
});

// DELETE final jeopardy question
app.delete('/api/final/:id', (req, res) => {
  const data = readData();
  const idx = data.finalJeopardy.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Question not found' });

  data.finalJeopardy.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// EXPORT — download the full questions.json
app.get('/api/export', (req, res) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="jeopardy-questions-${timestamp}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(DATA_FILE);
});

// IMPORT — upload a previously exported questions.json
app.post('/api/import', (req, res) => {
  const incoming = req.body;

  // Validate structure
  if (!incoming || !Array.isArray(incoming.categories)) {
    return res.status(400).json({ error: 'Invalid file: must have a "categories" array' });
  }
  if (incoming.categories.length > 8) {
    return res.status(400).json({ error: 'Too many categories (max 8)' });
  }
  for (const cat of incoming.categories) {
    if (!cat.id || !cat.name || !Array.isArray(cat.questions)) {
      return res.status(400).json({ error: `Invalid category: ${JSON.stringify(cat)}` });
    }
    if (cat.questions.length > 10) {
      return res.status(400).json({ error: `Category "${cat.name}" has more than 10 questions` });
    }
    for (const q of cat.questions) {
      if (!q.id || !q.question || !q.answer) {
        return res.status(400).json({ error: `Invalid question in "${cat.name}"` });
      }
    }
  }

  // Final jeopardy is optional; default to [] and validate if present
  if (incoming.finalJeopardy === undefined) incoming.finalJeopardy = [];
  if (!Array.isArray(incoming.finalJeopardy)) {
    return res.status(400).json({ error: '"finalJeopardy" must be an array' });
  }
  if (incoming.finalJeopardy.length > 5) {
    return res.status(400).json({ error: 'Too many Final Jeopardy questions (max 5)' });
  }
  for (const q of incoming.finalJeopardy) {
    if (!q.id || !q.question || !q.answer) {
      return res.status(400).json({ error: 'Invalid Final Jeopardy question' });
    }
  }

  // Backup current data before overwriting
  const backup = path.join(__dirname, 'data', `questions-backup-${Date.now()}.json`);
  fs.copyFileSync(DATA_FILE, backup);

  writeData(incoming);
  res.json({ success: true, categories: incoming.categories.length });
});

app.listen(PORT, () => {
  console.log(`🎮 Jeopardy server running at http://localhost:${PORT}`);
  console.log(`📝 Admin panel at http://localhost:${PORT}/admin.html`);
});
