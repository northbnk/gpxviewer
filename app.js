require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const { parseGpx, analyzeSegments } = require("./gpxutils.js");

const app = express();
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
    console.log("apikei:" + apiKey);
    res.render("result", { stats, googleMapsApiKey: apiKey, segmentSummary });
  } catch (err) {
    res.status(400).send("Failed to parse GPX");
  }
});

const port = process.env.PORT || 8180;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
