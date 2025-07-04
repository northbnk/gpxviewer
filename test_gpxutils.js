const fs = require('fs');
const assert = require('assert');
const { parseGpx } = require('./gpxutils.js');

let data = fs.readFileSync('testdata/sample.gpx', 'utf8');
let stats = parseGpx(data);
assert.strictEqual(stats.points, 5);
assert(stats.distance_m > 3900 && stats.distance_m < 4100);
assert.strictEqual(stats.trackpoints.length, 5);
assert.strictEqual(stats.per_km_elevation.length, 4);
assert.strictEqual(stats.per_km_elevation[0].gain, 10);
assert.strictEqual(stats.per_km_elevation[1].loss, 5);

data = fs.readFileSync('testdata/reverse.gpx', 'utf8');
stats = parseGpx(data);
assert.strictEqual(stats.points, 2);
assert.strictEqual(stats.trackpoints.length, 2);

data = fs.readFileSync('testdata/mmp8th_long.gpx', 'utf8');
stats = parseGpx(data);
assert(stats.points > 5);
assert.strictEqual(stats.profile.length, stats.trackpoints.length);

console.log('All tests passed');
