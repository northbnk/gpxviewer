const fs = require("fs");
const assert = require("assert");
const { parseGpx, summarizeStats } = require("./gpxutils.js");

let data = fs.readFileSync("testdata/sample.gpx", "utf8");
let stats = parseGpx(data);
assert.strictEqual(stats.points, 5);
assert.strictEqual(stats.name, "Example GPX");
assert(stats.distance_m > 3900 && stats.distance_m < 4100);
assert.strictEqual(stats.trackpoints.length, 5);
assert.strictEqual(stats.per_km_elevation.length, 4);
assert.strictEqual(stats.per_km_elevation[0].gain, 10);
assert.strictEqual(stats.per_km_elevation[1].loss, 5);
assert.strictEqual(stats.highest_elevation_m, 115);
assert.strictEqual(stats.lowest_elevation_m, 100);
assert.strictEqual(Math.round(stats.total_gain_m), 20);
assert.strictEqual(Math.round(stats.total_loss_m), 10);

data = fs.readFileSync("testdata/reverse.gpx", "utf8");
stats = parseGpx(data);
assert.strictEqual(stats.points, 2);
assert.strictEqual(stats.trackpoints.length, 2);
assert.strictEqual(stats.highest_elevation_m, 110);
assert.strictEqual(stats.lowest_elevation_m, 100);
assert.strictEqual(Math.round(stats.total_gain_m), 10);
assert.strictEqual(Math.round(stats.total_loss_m), 0);

data = fs.readFileSync("testdata/mmp8th_long.gpx", "utf8");
stats = parseGpx(data);
assert(stats.points > 5);
assert.strictEqual(stats.profile.length, stats.trackpoints.length);
assert(stats.highest_elevation_m > 1000);
assert(stats.lowest_elevation_m < 300);
assert(Math.abs(stats.total_gain_m - stats.total_loss_m) < 1);
assert(stats.per_km_elevation[0].duration_s > 0);

const summary = summarizeStats(stats);
assert(summary.total_distance_km > 50);
assert.strictEqual(summary.pace_per_km.length, stats.per_km_elevation.length);
assert(summary.max_pace_min_per_km <= summary.min_pace_min_per_km);

data = fs.readFileSync("testdata/sample_wp.gpx", "utf8");
stats = parseGpx(data);
assert.strictEqual(stats.waypoints.length, 2);
assert.strictEqual(stats.waypoints[0].name, "WP1");
assert.strictEqual(stats.waypoints[1].name, "WP2");
assert.strictEqual(stats.name, "Example GPX with WPT");

data = fs.readFileSync("testdata/kirishimaebino_long13th.gpx", "utf8");
stats = parseGpx(data);
assert(stats.points > 1000);
assert(stats.distance_m > 60000);
assert(stats.total_gain_m > 3000);

console.log("All tests passed");
