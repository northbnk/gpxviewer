const fs = require('fs');
const { parseGpx, analyzeSegments } = require('./gpxutils');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node segment_analysis.js <file.gpx>');
  process.exit(1);
}

try {
  const data = fs.readFileSync(file, 'utf8');
  const stats = parseGpx(data);
  const { segments, summary } = analyzeSegments(stats);

  console.log('KM\tDist(m)\tGain(m)\tLoss(m)\tUpRate(%)\tDownRate(%)\tNetRate(%)\tPace(min/km)');
  segments.forEach((seg, i) => {
    const paceStr = seg.pace_min_per_km == null ? '-' : seg.pace_min_per_km.toFixed(2);
    console.log(`${i + 1}\t${seg.dist_m.toFixed(0)}\t${seg.gain_m.toFixed(2)}\t${seg.loss_m.toFixed(2)}\t${seg.up_rate.toFixed(2)}\t${seg.down_rate.toFixed(2)}\t${seg.net_rate.toFixed(2)}\t${paceStr}`);
  });

  console.log('Group\tAvgNetRate(%)\tAvgPace(min/km)');
  summary.forEach(row => {
    if (row.avg_net_rate == null) {
      console.log(`${row.label}\t-\t-`);
    } else {
      const rateStr = row.avg_net_rate.toFixed(2);
      const paceStr = row.avg_pace == null ? '-' : row.avg_pace.toFixed(2);
      console.log(`${row.label}\t${rateStr}\t${paceStr}`);
    }
  });
} catch (err) {
  console.error('Failed to analyze:', err.message);
  process.exit(1);
}
