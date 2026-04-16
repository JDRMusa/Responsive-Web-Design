import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SCORES_FILE = path.join(__dirname, "data", "scores.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ensure scores file exists
function ensureScoresFile() {
  if (!fs.existsSync(SCORES_FILE)) {
    fs.writeFileSync(SCORES_FILE, JSON.stringify([]), "utf8");
  }
}
ensureScoresFile();

// GET leaderboard (top N)
app.get("/api/scores", (req, res) => {
  ensureScoresFile();
  try {
    const raw = fs.readFileSync(SCORES_FILE, "utf8");
    const scores = JSON.parse(raw);
    // sort descending by score
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, 50);
    res.json(top);
  } catch (err) {
    res.status(500).json({ error: "failed to read scores" });
  }
});

// POST a score: { name: string, score: number }
app.post("/api/scores", (req, res) => {
  ensureScoresFile();
  const { name, score } = req.body;
  const cleanName = (name || "Anon").toString().trim().slice(0, 30);
  const numScore = Number(score) || 0;

  try {
    const raw = fs.readFileSync(SCORES_FILE, "utf8");
    let scores = JSON.parse(raw);

    // Check if player name already exists
    const existing = scores.find(s => s.name === cleanName);

    if (existing) {
      // Only overwrite if the new score is a Personal Best
      if (numScore > existing.score) {
        existing.score = numScore;
        existing.date = new Date().toISOString();
      }
    } else {
      scores.push({ name: cleanName, score: numScore, date: new Date().toISOString() });
    }

    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
