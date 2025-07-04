const fs = require('fs');
const assert = require('assert');
const { parseGpx } = require('./gpxutils.js');

const data = fs.readFileSync('testdata/sample.gpx', 'utf8');
const stats = parseGpx(data);
assert.strictEqual(stats.points, 2);
assert(stats.distance_m > 0);
assert.strictEqual(stats.trackpoints.length, 2);
console.log('All tests passed');
