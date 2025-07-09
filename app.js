require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { parseGpx, summarizeStats, analyzeSegments } = require("./gpxutils.js");

function augmentStats(stats) {
  if (stats.trackpoints && stats.trackpoints.length > 1) {
    const times = stats.trackpoints
      .map((p) => p[3])
      .filter((t) => t != null);
    if (times.length >= 2) {
      const start = times[0];
      const end = times[times.length - 1];
      stats.total_time_s = (end - start) / 1000;
      if (stats.distance_m) {
        stats.avg_pace_min_per_km =
          (stats.total_time_s / 60) / (stats.distance_m / 1000);
      }
    }
  }
  return stats;
}

function buildPrompt(summary) {
  return `あなたは優秀なトレイルランニングコーチ兼アナリストです。以下のGPXデータを分析し、事実に基づく具体的な説明を文章で伝えてください。表やグラフは不要です。

【求める内容】
- 総距離、累積標高、平均ペース、総時間、最高高度、最低高度などの基本情報を文章で説明
- 区間ごとのペースや標高変化について文章で言及（例：「後半の急登区間ではペースが6分/km台に落ち込んでいます」など）
- 上りと下りでの走りの特徴やペースの違いを事実に基づき解説
- ペース変動の背景（疲労、坂、気温など）を推察し、文章で述べる
- 改善点や次回の戦略を具体的に提案
- 可能であれば、選手の強みや弱みを指摘し、今後のトレーニングに活かせるようなアドバイスを提供

【表現の指針】
- 数字は使ってよい（例：「累積標高は1,800mです」）
- 表やグラフなどの視覚的な要素は使わない
- 客観的かつわかりやすい文章で、選手に伝えるレポートのようにまとめる
- 見出しをつけ改行を入れて、各セクションを明確に分ける
- 大事な部分は強調する（例：「特に注意が必要な区間」など）

GPX統計データ: ${JSON.stringify(summary)}
`;
}

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname));
const upload = multer();
const PRED_DB = path.join(__dirname, "predicted_db.json");
const GPX_DB = path.join(__dirname, "gpx_db.json");

function readGpxDb() {
  try {
    return JSON.parse(fs.readFileSync(GPX_DB, "utf8"));
  } catch (_) {
    return [];
  }
}

function writeGpxDb(data) {
  fs.writeFileSync(GPX_DB, JSON.stringify(data, null, 2));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((p) => {
    const idx = p.indexOf("=");
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = p.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function ensureUid(req, res, next) {
  const cookies = parseCookies(req);
  let uid = cookies.uid;
  if (!uid) {
    uid = crypto.randomUUID();
    res.setHeader("Set-Cookie", `uid=${uid}; Path=/; HttpOnly`);
  }
  req.uid = uid;
  next();
}

app.use(ensureUid);

function readPredicted() {
  try {
    const txt = fs.readFileSync(PRED_DB, "utf8");
    return JSON.parse(txt);
  } catch (_) {
    return [];
  }
}

function writePredicted(data) {
  fs.writeFileSync(PRED_DB, JSON.stringify(data, null, 2));
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "templates"));

app.get("/", (req, res) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLEMAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY;
  res.render("vuetify", { googleMapsApiKey: apiKey });
});

app.get("/vue", (req, res) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLEMAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY;
  res.render("vue", { googleMapsApiKey: apiKey });
});



app.post("/api/upload", upload.single("gpxfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file" });
  }
  try {
    const text = req.file.buffer.toString();
    const stats = parseGpx(text);
    const segmentSummary = analyzeSegments(stats);
    const all = readGpxDb();
    const id = crypto.randomUUID();
    all.push({
      id,
      uid: req.uid,
      name: req.file.originalname,
      gpx: text,
      created: Date.now(),
    });
    writeGpxDb(all);
    res.json({ id, stats, segmentSummary });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse" });
  }
});

app.get("/api/predicted", (req, res) => {
  res.json({ data: readPredicted() });
});

app.post("/api/predicted", (req, res) => {
  const data = req.body.data;
  if (!Array.isArray(data)) return res.status(400).json({ error: "Invalid data" });
  try {
    writePredicted(data);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});

app.get("/api/gpx", (req, res) => {
  const list = readGpxDb()
    .filter((r) => r.uid === req.uid)
    .map(({ id, name, created }) => ({ id, name, created }));
  res.json({ data: list });
});

app.get("/api/gpx/:id", (req, res) => {
  const id = req.params.id;
  const entry = readGpxDb().find((r) => r.id === id && r.uid === req.uid);
  if (!entry) return res.status(404).json({ error: "Not found" });
  try {
    const stats = parseGpx(entry.gpx);
    const segmentSummary = analyzeSegments(stats);
    res.json({ stats, segmentSummary });
  } catch (err) {
    res.status(500).json({ error: "Failed to parse" });
  }
});

app.post("/generate-analysis", async (req, res) => {
  const stats = req.body.stats;
  if (!stats) return res.status(400).json({ error: "Missing stats" });
  augmentStats(stats);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OpenAI API key not configured" });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildPrompt(summarizeStats(stats)) }],
      }),
    });
    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      console.error("Invalid OpenAI response:", data);
      return res.status(500).json({ error: "Invalid response from OpenAI" });
    }
    const text = data.choices[0].message.content;
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
});

const port = process.env.PORT || 8180;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
