function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = d => d * Math.PI / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);
  const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlambda/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function extractTrackpoints(text) {
  const trackpoints = [];
  const regex = /<trkpt\b([^>]*)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let match;
  let highest = -Infinity;
  let lowest = Infinity;
  while ((match = regex.exec(text)) !== null) {
    const attrs = match[1];
    const content = match[2] || '';
    const latMatch = /lat="([^"]+)"/.exec(attrs);
    const lonMatch = /lon="([^"]+)"/.exec(attrs);
    if (!latMatch || !lonMatch) continue;
    let ele = null;
    const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(content);
    if (eleMatch) {
      ele = parseFloat(eleMatch[1]);
      if (ele > highest) highest = ele;
      if (ele < lowest) lowest = ele;
    }
    let time = null;
    const timeMatch = /<time>([^<]+)<\/time>/i.exec(content);
    if (timeMatch) {
      const t = Date.parse(timeMatch[1]);
      if (!Number.isNaN(t)) time = t;
    }
    trackpoints.push([parseFloat(latMatch[1]), parseFloat(lonMatch[1]), ele, time]);
  }
  return {
    trackpoints,
    highest: highest === -Infinity ? null : highest,
    lowest: lowest === Infinity ? null : lowest
  };
}

function calcPerKmStats(trackpoints, step = 1000) {
  let dist = 0;
  const perKm = [];
  const profile = [[0, trackpoints[0][2]]];
  let totalGain = 0;
  let totalLoss = 0;
  trackpoints[0][4] = 0; // cumulative distance
  for (let i = 1; i < trackpoints.length; i++) {
    const kmIndex = Math.floor(dist / step);
    if (!perKm[kmIndex]) {
      perKm[kmIndex] = {
        km: kmIndex + 1,
        gain: 0,
        loss: 0,
        start_time: trackpoints[i - 1][3],
        end_time: null,
        start_idx: i - 1,
        end_idx: null
      };
    }
    const ele1 = trackpoints[i - 1][2];
    const ele2 = trackpoints[i][2];
    if (ele1 != null && ele2 != null) {
      const diff = ele2 - ele1;
      if (diff > 0) {
        perKm[kmIndex].gain += diff;
        totalGain += diff;
      } else if (diff < 0) {
        perKm[kmIndex].loss += -diff;
        totalLoss += -diff;
      }
    }
    const segDist = haversine(trackpoints[i - 1][0], trackpoints[i - 1][1], trackpoints[i][0], trackpoints[i][1]);
    dist += segDist;
    trackpoints[i][4] = dist;
    perKm[kmIndex].end_time = trackpoints[i][3];
    perKm[kmIndex].end_idx = i;
    profile.push([dist, trackpoints[i][2]]);
  }
  perKm.forEach(km => {
    let st = km.start_time;
    let en = km.end_time;
    if (km.start_idx != null && km.end_idx != null) {
      if (st == null) {
        for (let i = km.start_idx; i <= km.end_idx; i++) {
          if (trackpoints[i][3] != null) { st = trackpoints[i][3]; break; }
        }
      }
      if (en == null) {
        for (let i = km.end_idx; i >= km.start_idx; i--) {
          if (trackpoints[i][3] != null) { en = trackpoints[i][3]; break; }
        }
      }
    }
    if (st != null && en != null) {
      km.duration_s = (en - st) / 1000;
    } else {
      km.duration_s = null;
    }
  });

  return {
    perKm,
    profile,
    distance: dist,
    totalGain,
    totalLoss
  };
}

function parseGpx(text) {
  const { trackpoints, highest, lowest } = extractTrackpoints(text);
  const stats = { points: trackpoints.length };
  if (trackpoints.length > 0) {
    const lats = trackpoints.map(p => p[0]);
    const lons = trackpoints.map(p => p[1]);
    stats.bounds = {
      min_lat: Math.min(...lats),
      max_lat: Math.max(...lats),
      min_lon: Math.min(...lons),
      max_lon: Math.max(...lons)
    };
    const { perKm, profile, distance, totalGain, totalLoss } = calcPerKmStats(trackpoints, 1000);
    stats.distance_m = distance;
    stats.per_km_elevation = perKm;
    stats.profile = profile;
    stats.total_gain_m = totalGain;
    stats.total_loss_m = totalLoss;
  }
  stats.highest_elevation_m = highest;
  stats.lowest_elevation_m = lowest;
  stats.trackpoints = trackpoints;
  return stats;
}

function analyzeSlopeTime(stats, upThreshold, downThreshold) {
  if (!stats.per_km_elevation) return { up_threshold: upThreshold, down_threshold: downThreshold, up_time_s: 0, down_time_s: 0 };
  let up = 0;
  let down = 0;
  stats.per_km_elevation.forEach(km => {
    if (km.duration_s == null) return;
    const upRate = (km.gain / 1000) * 100;
    const downRate = (km.loss / 1000) * 100;
    if (upRate >= upThreshold) up += km.duration_s;
    if (downRate >= downThreshold) down += km.duration_s;
  });
  return { up_threshold: upThreshold, down_threshold: downThreshold, up_time_s: up, down_time_s: down };
}


function analyzeSegments(stats, interval = 500) {
  const { perKm } = calcPerKmStats(stats.trackpoints, interval);
  const segments = [];
  for (let i = 0; i < perKm.length; i++) {
    const segDist = i === perKm.length - 1
      ? Math.max(0, stats.distance_m - i * interval)
      : interval;
    const gain = perKm[i].gain;
    const loss = perKm[i].loss;
    const upRate = segDist > 0 ? (gain / segDist) * 100 : 0;
    const downRate = segDist > 0 ? (loss / segDist) * 100 : 0;
    const netRate = upRate - downRate;
    const duration = perKm[i].duration_s;
    const pace = duration && segDist > 0
      ? (duration / 60) / (segDist / 1000)
      : null;
    segments.push({
      km: i + 1,
      dist_m: segDist,
      gain_m: gain,
      loss_m: loss,
      up_rate: upRate,
      down_rate: downRate,
      net_rate: netRate,
      duration_s: duration,
      pace_min_per_km: pace
    });
  }

  const ranges = [
    { label: '[-40% -    ]', min: -Infinity, max: -40, segs: [] },
    { label: '[-20% - -40%]', min: -40, max: -20, segs: [] },
    { label: '[ -5% - -20%]', min: -20, max: -5, segs: [] },
    { label: '[-5%  -   5%]', min: -5, max: 5, segs: [] },
    { label: '[5%  -  20%]', min: 5, max: 20, segs: [] },
    { label: '[20% -  40%]', min: 20, max: 40, segs: [] },
    { label: '[40% -    ]', min: 40, max: Infinity, segs: [] }
  ];

  segments.forEach(seg => {
    const grp = ranges.find(r => seg.net_rate >= r.min && seg.net_rate < r.max);
    if (grp) grp.segs.push(seg);
  });

  const summary = ranges.map(r => {
    const cnt = r.segs.length;
    if (!cnt) return { label: r.label, avg_net_rate: null, avg_pace: null };
    const avgRate = r.segs.reduce((s, x) => s + x.net_rate, 0) / cnt;
    const paceSegs = r.segs.filter(x => x.pace_min_per_km != null && x.duration_s != null);
    const totalDist = paceSegs.reduce((s, x) => s + x.dist_m, 0);
    const totalTime = paceSegs.reduce((s, x) => s + x.duration_s, 0);
    const avgPace = paceSegs.length && totalTime > 0
      ? (totalTime / 60) / (totalDist / 1000)
      : null;
    return { label: r.label, avg_net_rate: avgRate, avg_pace: avgPace };
  });

  return { segments, summary };
}

module.exports = {
  parseGpx,
  analyzeSlopeTime,
  analyzeSegments
};
