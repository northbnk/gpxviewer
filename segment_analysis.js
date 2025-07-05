const fs = require('fs');
const { parseGpx } = require('./gpxutils');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node segment_analysis.js <file.gpx>');
  process.exit(1);
}

try {
  const data = fs.readFileSync(file, 'utf8');
  const stats = parseGpx(data);
  const perKm = stats.per_km_elevation || [];
  const segments = [];
  for (let i = 0; i < perKm.length; i++) {
    const segDist = i === perKm.length - 1
      ? Math.max(0, stats.distance_m - i * 1000)
      : 1000;
    const gain = perKm[i].gain;
    const loss = perKm[i].loss;
    const upRate = segDist > 0 ? (gain / segDist) * 100 : 0;
    const downRate = segDist > 0 ? (loss / segDist) * 100 : 0;
    const rawNet = upRate - downRate;
    const netRate = rawNet < 0 ? 0 : rawNet;
    const duration = perKm[i].duration_s;
    const speed = duration && segDist > 0 ? (segDist / 1000) / (duration / 3600) : null;
    segments.push({ index: i + 1, netRate, speed });
  }

  const groups = [
    { label: '[0%, 5%)', min: 0, max: 5, segs: [] },
    { label: '[5%, 10%)', min: 5, max: 10, segs: [] },
    { label: '[10%, 15%)', min: 10, max: 15, segs: [] },
    { label: '[15%, 20%)', min: 15, max: 20, segs: [] },
    { label: '[20%以上]', min: 20, max: Infinity, segs: [] }
  ];

  segments.forEach(seg => {
    const rate = seg.netRate < 0 ? 0 : seg.netRate;
    const group = groups.find(g => rate >= g.min && rate < g.max);
    if (group) group.segs.push(seg);
  });

  console.log('Group\tAvgNetRate(%)\tAvgSpeed(km/h)');
  groups.forEach(g => {
    const count = g.segs.length;
    if (count === 0) {
      console.log(`${g.label}\t-\t-`);
    } else {
      const avgRate = g.segs.reduce((s, x) => s + x.netRate, 0) / count;
      const speedSegs = g.segs.filter(x => x.speed != null);
      const avgSpeed = speedSegs.length === 0 ? 0 :
        speedSegs.reduce((s, x) => s + x.speed, 0) / speedSegs.length;
      console.log(`${g.label}\t${avgRate.toFixed(2)}\t${avgSpeed.toFixed(2)}`);
    }
  });
} catch (err) {
  console.error('Failed to analyze:', err.message);
  process.exit(1);
}
