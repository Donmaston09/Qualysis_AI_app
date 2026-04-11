# Qualysis — Qualitative Research Engine

AI-powered qualitative analysis: upload or paste datasets, set a hypothesis, and get structured theme maps, sentiment breakdowns, and strategic recommendations.

## Features
- Upload **TXT, CSV, XLSX, PDF, DOCX, MD** files or paste data directly
- Thematic coding with What / Why split and latent need extraction
- Sentiment distribution (positive / negative / neutral / ambivalent)
- Hypothesis verdict: Supported / Partially Supported / Refuted / Inconclusive
- Anomaly detection and strategic recommendations
- Powered by Claude claude-sonnet-4-20250514 via a secure server-side API proxy

---

## Local development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/qualysis.git
cd qualysis
npm install
```

### 2. Add your API key

```bash
cp .env.example .env
# Open .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run

```bash
npm run dev     # development (auto-restarts on change)
npm start       # production
```

Open http://localhost:3000

---

## Deploy to Render via GitHub

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/qualysis.git
git push -u origin main
```

### Step 2 — Create a Render Web Service

1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub account and select the `qualysis` repository
4. Render will detect `render.yaml` automatically. Confirm these settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free (or paid for always-on)

### Step 3 — Set the API key

In the Render dashboard for your service:
1. Go to **Environment** tab
2. Add a new variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` (your key from console.anthropic.com)
3. Click **Save Changes** — Render will redeploy automatically

### Step 4 — Done

Your app will be live at `https://qualysis.onrender.com` (or your custom domain).

> **Note on the free plan:** Render free services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start. Upgrade to the Starter plan ($7/mo) for always-on.

---

## Project structure

```
qualysis/
├── public/
│   └── index.html        # Full frontend (single-page app)
├── src/
│   └── server.js         # Express server + file extraction + Claude API proxy
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
├── render.yaml           # Render deployment config
└── README.md
```

## Supported file types

| Format | Notes |
|--------|-------|
| `.txt` / `.md` | Plain text, one response per line |
| `.csv` | Comma or tab separated, all columns extracted |
| `.xlsx` / `.xls` | All sheets extracted |
| `.pdf` | Text-layer PDFs (not scanned images) |
| `.docx` / `.doc` | Word documents |

Max file size: **10 MB**

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload file → returns extracted text |
| `POST` | `/api/analyse` | Run Claude analysis → returns JSON report |

---

## Security notes

- The `ANTHROPIC_API_KEY` is stored as a server-side environment variable and never sent to the browser
- File uploads are processed in memory (no disk writes)
- `.env` is in `.gitignore` — never commit it
