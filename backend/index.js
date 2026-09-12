const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");

const app  = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// In-memory session store (demo only)
const sessions = new Map();

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "AI Talent Acquisition API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

app.get("/api/jobs", (req, res) => {
  res.json([
    { id: 1, title: "Frontend Developer",   company: "TechCorp",   location: "Remote" },
    { id: 2, title: "Backend Engineer",     company: "DataInc",    location: "New York" },
    { id: 3, title: "AI/ML Engineer",       company: "AI Labs",    location: "San Francisco" },
    { id: 4, title: "Full Stack Developer", company: "StartupXYZ", location: "Remote" },
  ]);
});

// ── Auth ──────────────────────────────────────────────────────────
const DEMO_USERS = [
  { email: "admin@talent.ai", password: "password123", name: "Admin User" },
  { email: "user@talent.ai",  password: "test1234",    name: "Test User"  },
];

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const user = DEMO_USERS.find(u => u.email === email && u.password === password);
  if (!user)
    return res.status(401).json({ error: "Invalid email or password." });

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { email: user.email, name: user.name, loginAt: new Date().toISOString() });

  console.log("Login ->", user.email);
  res.json({ token, name: user.name, email: user.email });
});

app.post("/api/logout", (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token || !sessions.has(token))
    return res.status(401).json({ error: "Invalid or expired session." });

  const user = sessions.get(token);
  sessions.delete(token);
  console.log("Logout ->", user.email);
  res.json({ message: "Goodbye, " + user.name + "! You have been logged out." });
});

app.get("/api/me", (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token || !sessions.has(token))
    return res.status(401).json({ error: "Not authenticated." });
  res.json(sessions.get(token));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend running on http://0.0.0.0:" + PORT);
});
