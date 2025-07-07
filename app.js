require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const { parseGpx, analyzeSegments } = require("./gpxutils.js");

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

function buildPrompt(stats) {
  return `あなたは優秀なトレイルランニングコーチ兼アナリストです。以下のGPXデータを分析し、事実に基づく具体的な説明を文章で伝えてください。表やグラフは不要です。

【求める内容】
- 総距離、累積標高、平均ペース、総時間、最高高度、最低高度などの基本情報を文章で説明
- 区間ごとのペースや標高変化について文章で言及（例：「後半の急登区間ではペースが6分/km台に落ち込んでいます」など）
- 上りと下りでの走りの特徴やペースの違いを事実に基づき解説
- ペース変動の背景（疲労、坂、気温など）を推察し、文章で述べる
- 改善点や次回の戦略を具体的に提案

【表現の指針】
- 数字は使ってよい（例：「累積標高は1,800mです」）
- 表やグラフなどの視覚的な要素は使わない
- 客観的かつわかりやすい文章で、選手に伝えるレポートのようにまとめる

GPX統計データ: ${JSON.stringify(stats)}
`;
}

const app = express();
app.use(express.json({ limit: "5mb" }));
const upload = multer();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "templates"));

app.get("/", (req, res) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLEMAPS_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY;
  res.render("result", {
    stats: {},
    googleMapsApiKey: apiKey,
    segmentSummary: {},
  });
});

app.post("/upload", upload.single("gpxfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }
  try {
    const stats = parseGpx(req.file.buffer.toString());
    const segmentSummary = analyzeSegments(stats);
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLEMAPS_API_KEY ||
      process.env.GOOGLE_MAP_API_KEY;
    res.render("result", { stats, googleMapsApiKey: apiKey, segmentSummary });
  } catch (err) {
    res.status(400).send("Failed to parse GPX");
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
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: buildPrompt(stats) }],
      }),
    });
    const data = await response.json();
    const text = data.choices && data.choices[0]?.message?.content;
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
