const fs = require("fs");
const { parseGpx, analyzeSlopeTime } = require("./gpxutils");

const [, , file, upStr, downStr] = process.argv;
if (!file || !upStr || !downStr) {
  console.error(
    "Usage: node analyze.js <file.gpx> <up_threshold_percent> <down_threshold_percent>",
  );
  process.exit(1);
}

try {
  const data = fs.readFileSync(file, "utf8");
  const stats = parseGpx(data);
  const result = analyzeSlopeTime(
    stats,
    parseFloat(upStr),
    parseFloat(downStr),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("Failed to analyze:", err.message);
  process.exit(1);
}
