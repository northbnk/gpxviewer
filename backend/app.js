require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { parseGpx, summarizeStats, analyzeSegments } = require("./gpxutils.js");

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "",
);

const GPX_TABLE = "gpx_files";
const GPX_BUCKET = "gpx";

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

function buildCoursePrompt(summary) {
  return `あなたはプロのトレイルランナーであり、かつ中級者・初心者向けのアドバイザーです。
以下のGPXデータ（距離・累積標高・上昇率・降下率）を分析し、選手が安全かつ効率的に走れるよう以下のアドバイスをまとめてください。

■ コース全体の概要
- 総距離
- 累積標高（登り・下り）
- 最大標高・最低標高
- 平均勾配
- テクニカルセクション（岩場、急登、急降下、稜線など）

■ ペース戦略
- プッシュするポイント（攻めるべき区間）
- 守るポイント（ペースを抑える区間）
- セクションごとの推奨ペース（初心者・中級者別に具体的なkmあたり分数）

■ 補給戦略
- 推奨される水分量（総量と1時間あたり目安）
- 行動食（補給タイミングとおすすめの種類：ジェル、ソリッド、塩タブレットなど）
- 電解質の摂取目安

■ 携行装備
- ウェアや防寒具の選択（天候・標高差を考慮）
- シューズやポールの使用有無
- 緊急用装備（ファーストエイド、ライト、エマージェンシーシート）

■ メンタル面のアドバイス
- 中盤や後半にメンタルを保つコツ
- 失速しないための意識ポイント

■ 初心者・中級者・上級者向けの共通＆個別アドバイス
- それぞれに最適化した戦略と注意点

GPX統計データ: ${JSON.stringify(summary)}
`;
}

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
const upload = multer();
const PRED_DB = path.join(__dirname, "predicted_db.json");

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
app.set("views", path.join(__dirname, "..", "frontend", "templates"));

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
    const id = crypto.randomUUID();
    const pathOnStorage = `${id}.gpx`;

    const { error: uploadErr } = await supabase
      .storage
      .from(GPX_BUCKET)
      .upload(pathOnStorage, req.file.buffer);

    if (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: "Failed to store file" });
    }

    const { error: dbErr } = await supabase.from(GPX_TABLE).insert({
      user_id:id,
      uid: req.uid,
      name: req.file.originalname,
      title: req.body.title || "",
      path: pathOnStorage,
      created_at: new Date().toISOString(),
    });

    if (dbErr) {
      console.error(dbErr);
      return res.status(500).json({ error: "Failed to save metadata" });
    }

    res.json({ id, stats, segmentSummary });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse" });
  }
});

app.post("/api/parse", upload.single("gpxfile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file" });
  }
  try {
    const text = req.file.buffer.toString();
    const stats = parseGpx(text);
    const segmentSummary = analyzeSegments(stats);
    res.json({ stats, segmentSummary });
  } catch (err) {
    res.status(400).json({ error: "Failed to parse" });
  }
});

app.get("/api/sample", (_req, res) => {
  try {
    const filePath = path.join(__dirname, "testdata", "kirishimaebino_long13th.gpx");
    const text = fs.readFileSync(filePath, "utf8");
    const stats = parseGpx(text);
    const segmentSummary = analyzeSegments(stats);
    res.json({ stats, segmentSummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load sample" });
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

app.get("/api/gpx", async (req, res) => {
  const { data, error } = await supabase
    .from(GPX_TABLE)
    .select("id,name,title,created_at")
    .eq("uid", req.uid)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Failed to fetch list" });
  res.json({ data });
});

app.get("/api/gpx/:id", async (req, res) => {
  const id = req.params.id;
  const { data: entry, error } = await supabase
    .from(GPX_TABLE)
    .select("path")
    .eq("id", id)
    .eq("uid", req.uid)
    .single();
  if (error || !entry) return res.status(404).json({ error: "Not found" });

  const { data: fileData, error: downloadErr } = await supabase
    .storage
    .from(GPX_BUCKET)
    .download(entry.path);

  if (downloadErr || !fileData) {
    console.error(downloadErr);
    return res.status(500).json({ error: "Failed to load file" });
  }

  try {
    const text = await fileData.text();
    const stats = parseGpx(text);
    const segmentSummary = analyzeSegments(stats);
    res.json({ stats, segmentSummary });
  } catch (err) {
    res.status(500).json({ error: "Failed to parse" });
  }
});

app.patch("/api/gpx/:id", async (req, res) => {
  const id = req.params.id;
  const title = req.body.title;
  if (typeof title !== "string") {
    return res.status(400).json({ error: "Invalid title" });
  }
  const { error } = await supabase
    .from(GPX_TABLE)
    .update({ title })
    .eq("id", id)
    .eq("uid", req.uid);
  if (error) return res.status(500).json({ error: "Failed to update" });
  res.json({ status: "ok" });
});

app.delete("/api/gpx/:id", async (req, res) => {
  const id = req.params.id;
  console.log(`Deleting GPX with ID: ${id}, UID: ${req.uid}`);
  const { data: entry, error } = await supabase
    .from(GPX_TABLE)
    .select("path")
    .eq("id", id)
    .eq("uid", req.uid)
    .single();
  if (error || !entry) return res.status(404).json({ error: "Not found" });

  const { error: delErr } = await supabase
    .storage
    .from(GPX_BUCKET)
    .remove([entry.path]);

  const { error: dbErr } = await supabase
    .from(GPX_TABLE)
    .delete()
    .eq("id", id)
    .eq("uid", req.uid);

  if (delErr || dbErr) {
    console.error(delErr || dbErr);
    return res.status(500).json({ error: "Failed to delete" });
  }

  res.json({ status: "ok" });
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

app.post("/generate-course-analysis", async (req, res) => {
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
        messages: [{ role: "user", content: buildCoursePrompt(summarizeStats(stats)) }],
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
