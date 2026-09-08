const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'AI Talent Acquisition API is running 🚀' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/api/jobs', (req, res) => {
  res.json([
    { id: 1, title: 'Frontend Developer',    company: 'TechCorp',   location: 'Remote' },
    { id: 2, title: 'Backend Engineer',      company: 'DataInc',    location: 'New York' },
    { id: 3, title: 'AI/ML Engineer',        company: 'AI Labs',    location: 'San Francisco' },
    { id: 4, title: 'Full Stack Developer',  company: 'StartupXYZ', location: 'Remote' },
  ]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on http://0.0.0.0:${PORT}`);
});
