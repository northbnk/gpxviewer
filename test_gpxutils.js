const fs = require('fs');
const assert = require('assert');
const { parseGpx } = require('./gpxutils.js');

const data = fs.readFileSync('testdata/sample.gpx', 'utf8');
const stats = parseGpx(data);
assert.strictEqual(stats.points, 2);
assert(stats.distance_m > 0);
console.log('All tests passed');
