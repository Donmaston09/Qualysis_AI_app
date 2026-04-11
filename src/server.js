import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── 1. INITIALIZE CLIENTS ───────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ── 2. MIDDLEWARE ───────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // Increased to 15MB
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../public")));

// ── 3. EXTRACTION HELPER ────────────────────────────────────────────────────
async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  try {
    if ([".txt", ".md"].includes(ext)) return buffer.toString("utf-8");
    if (ext === ".csv") {
      const records = parse(buffer, { skip_empty_lines: true, relax_column_count: true });
      return records.map((r) => r.join("\t")).join("\n");
    }
    if ([".xlsx", ".xls"].includes(ext)) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      return wb.SheetNames.map(name => `[Sheet: ${name}]\n` + XLSX.utils.sheet_to_csv(wb.Sheets[name])).join("\n\n");
    }
    if ([".doc", ".docx"].includes(ext)) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    return buffer.toString("utf-8").slice(0, 50000);
  } catch (e) {
    throw new Error(`Failed to parse ${ext} file: ${e.message}`);
  }
}

// ── 4. ROUTES ───────────────────────────────────────────────────────────────

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file received" });
    const text = await extractText(req.file.buffer, req.file.originalname);
    res.json({
      text,
      preview: text.slice(0, 500),
      filename: req.file.originalname,
      chars: text.length
    });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

app.post("/api/analyse", async (req, res) => {
  const { data, provider = "google", hypothesis, context } = req.body;
  if (!data) return res.status(400).json({ error: "No data provided" });

  const systemPrompt = `You are a Senior Qualitative Data Scientist. Return ONLY valid JSON.
  Exact Structure Required:
  {
    "meta": { "responseCount": 0, "verdictLabel": "SUPPORTED", "verdictClass": "supported", "confidenceLevel": "High", "storySummary": "" },
    "themes": [{ "name": "", "pct": 0, "sentiment": "neutral", "evidence": "", "why": "" }],
    "sentiment": { "positive": { "pct": 0 }, "negative": { "pct": 0 }, "neutral": { "pct": 0 } },
    "recommendations": [{ "title": "", "action": "" }]
  }`;

  const userPrompt = `Context: ${context || "N/A"}\nHypothesis: ${hypothesis || "N/A"}\nDATASET:\n${data}`;

  try {
    let resultText;
    if (provider === "google") {
      const model = googleAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
      const result = await model.generateContent([systemPrompt, userPrompt]);
      resultText = result.response.text();
    } else {
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      resultText = message.content[0].text;
    }

    // Sanitize and Parse
    const cleanJson = resultText.replace(/```json|```/g, "").trim();
    const finalData = JSON.parse(cleanJson);

    // ── DATA NORMALIZATION LAYER (Prevents UI Crashes) ──

    // 1. Normalize Meta
    if (!finalData.meta) finalData.meta = {};
    finalData.meta.verdictClass = finalData.meta.verdictClass || "inconclusive";
    finalData.meta.verdictLabel = finalData.meta.verdictLabel || "INCONCLUSIVE";

    // 2. Normalize Sentiment (Fixes 'pct' error)
    if (!finalData.sentiment) finalData.sentiment = {};
    ['positive', 'negative', 'neutral'].forEach(key => {
      if (!finalData.sentiment[key]) finalData.sentiment[key] = { pct: 0 };
      if (typeof finalData.sentiment[key].pct !== 'number') finalData.sentiment[key].pct = 0;
    });

    // 3. Normalize Themes (Fixes 'pct' error)
    if (!Array.isArray(finalData.themes)) finalData.themes = [];
    finalData.themes = finalData.themes.map(t => ({
      name: t.name || "General Insight",
      pct: typeof t.pct === 'number' ? t.pct : 0,
      sentiment: t.sentiment || "neutral",
      evidence: t.evidence || "",
      why: t.why || ""
    }));

    res.json(finalData);

  } catch (err) {
    console.error(`Detailed Error:`, err);
    res.status(500).json({ error: "Analysis failed. Please check API keys or data format." });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

app.listen(PORT, () => {
  console.log(`🚀 Qualysis 2026 Engine Running: http://localhost:${PORT}`);
});