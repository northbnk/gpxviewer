function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extractTrackpoints(text) {
  const parse = (tag) => {
    const arr = [];
    const reg = new RegExp(`<${tag}\\b([^>]*)(?:/>|>([\\s\\S]*?)</${tag}>)`, "g");
    let m;
    let hi = -Infinity;
    let lo = Infinity;
    while ((m = reg.exec(text)) !== null) {
      const attrs = m[1];
      const content = m[2] || "";
      const latMatch = /lat="([^"]+)"/.exec(attrs);
      const lonMatch = /lon="([^"]+)"/.exec(attrs);
      if (!latMatch || !lonMatch) continue;
      let ele = null;
      const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(content);
      if (eleMatch) {
        ele = parseFloat(eleMatch[1].trim());
        if (ele > hi) hi = ele;
        if (ele < lo) lo = ele;
      }
      let time = null;
      const timeMatch = /<time>([^<]+)<\/time>/i.exec(content);
      if (timeMatch) {
        const t = Date.parse(timeMatch[1].trim());
        if (!Number.isNaN(t)) time = t;
      }
      arr.push([parseFloat(latMatch[1]), parseFloat(lonMatch[1]), ele, time]);
    }
    return { arr, hi, lo };
  };

  let { arr, hi, lo } = parse("trkpt");
  if (arr.length === 0) {
    const alt = parse("rtept");
    arr = alt.arr;
    hi = alt.hi;
    lo = alt.lo;
  }

  return {
    trackpoints: arr,
    highest: hi === -Infinity ? null : hi,
    lowest: lo === Infinity ? null : lo,
  };
}

function extractWaypoints(text) {
  const waypoints = [];
  const regex = /<wpt\b([^>]*)(?:\/>|>([\s\S]*?)<\/wpt>)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const attrs = match[1];
    const content = match[2] || "";
    const latMatch = /lat="([^"]+)"/.exec(attrs);
    const lonMatch = /lon="([^"]+)"/.exec(attrs);
    if (!latMatch || !lonMatch) continue;
    const wp = {
      lat: parseFloat(latMatch[1]),
      lon: parseFloat(lonMatch[1]),
    };
    const nameMatch = /<name>([^<]+)<\/name>/i.exec(content);
    if (nameMatch) wp.name = nameMatch[1];
    waypoints.push(wp);
  }
  return waypoints;
}

function calcPerKmStats(trackpoints, step = 100) {
  if (!trackpoints || trackpoints.length === 0) {
    return { perKm: [], profile: [], distance: 0, totalGain: 0, totalLoss: 0 };
  }
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
        end_idx: null,
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
    const segDist = haversine(
      trackpoints[i - 1][0],
      trackpoints[i - 1][1],
      trackpoints[i][0],
      trackpoints[i][1],
    );
    dist += segDist;
    trackpoints[i][4] = dist;
    perKm[kmIndex].end_time = trackpoints[i][3];
    perKm[kmIndex].end_idx = i;
    profile.push([dist, trackpoints[i][2]]);
  }
  perKm.forEach((km) => {
    let st = km.start_time;
    let en = km.end_time;
    if (km.start_idx != null && km.end_idx != null) {
      if (st == null) {
        for (let i = km.start_idx; i <= km.end_idx; i++) {
          if (trackpoints[i][3] != null) {
            st = trackpoints[i][3];
            break;
          }
        }
      }
      if (en == null) {
        for (let i = km.end_idx; i >= km.start_idx; i--) {
          if (trackpoints[i][3] != null) {
            en = trackpoints[i][3];
            break;
          }
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
    totalLoss,
  };
}

function parseGpx(text) {
  const { trackpoints, highest, lowest } = extractTrackpoints(text);
  const waypoints = extractWaypoints(text);
  const stats = { points: trackpoints.length };
  if (trackpoints.length > 0) {
    const lats = trackpoints.map((p) => p[0]);
    const lons = trackpoints.map((p) => p[1]);
    stats.bounds = {
      min_lat: Math.min(...lats),
      max_lat: Math.max(...lats),
      min_lon: Math.min(...lons),
      max_lon: Math.max(...lons),
    };
    const { perKm, profile, distance, totalGain, totalLoss } = calcPerKmStats(
      trackpoints,
      1000,
    );
    stats.distance_m = distance;
    stats.per_km_elevation = perKm;
    stats.profile = profile;
    stats.total_gain_m = totalGain;
    stats.total_loss_m = totalLoss;
  }
  stats.highest_elevation_m = highest;
  stats.lowest_elevation_m = lowest;
  stats.trackpoints = trackpoints;
  stats.waypoints = waypoints;
  return stats;
}

function analyzeSlopeTime(stats, upThreshold, downThreshold) {
  if (!stats.per_km_elevation)
    return {
      up_threshold: upThreshold,
      down_threshold: downThreshold,
      up_time_s: 0,
      down_time_s: 0,
    };
  let up = 0;
  let down = 0;
  stats.per_km_elevation.forEach((km) => {
    if (km.duration_s == null) return;
    const upRate = (km.gain / 1000) * 100;
    const downRate = (km.loss / 1000) * 100;
    if (upRate >= upThreshold) up += km.duration_s;
    if (downRate >= downThreshold) down += km.duration_s;
  });
  return {
    up_threshold: upThreshold,
    down_threshold: downThreshold,
    up_time_s: up,
    down_time_s: down,
  };
}

function analyzeSegments(stats, interval = 500) {
  if (!stats.trackpoints || stats.trackpoints.length === 0) {
    return { segments: [], summary: [] };
  }
  const { perKm } = calcPerKmStats(stats.trackpoints, interval);
  const segments = [];
  const numSegs = Math.ceil(stats.distance_m / interval);
  for (let i = 0; i < numSegs; i++) {
    const kmData = perKm[i] || {};
    const segDist =
      i === numSegs - 1
        ? Math.max(0, stats.distance_m - i * interval)
        : interval;
    const gain = kmData.gain || 0;
    const loss = kmData.loss || 0;
    const upRate = segDist > 0 ? (gain / segDist) * 100 : 0;
    const downRate = segDist > 0 ? (loss / segDist) * 100 : 0;
    const netRate = upRate - downRate;
    const duration = kmData.duration_s;
    const pace =
      duration && segDist > 0 ? duration / 60 / (segDist / 1000) : null;
    segments.push({
      km: i + 1,
      dist_m: segDist,
      gain_m: gain,
      loss_m: loss,
      up_rate: upRate,
      down_rate: downRate,
      net_rate: netRate,
      duration_s: duration,
      pace_min_per_km: pace,
    });
  }

  const ranges = [
    { label: "-50% -    ", min: -Infinity, max: -50, segs: [] },
    { label: "-50% - -40%", min: -50, max: -40, segs: [] },
    { label: "-40% - -30%", min: -40, max: -30, segs: [] },
    { label: "-30% - -20%", min: -30, max: -20, segs: [] },
    { label: "-20% - -10%", min: -20, max: -10, segs: [] },
    { label: "-10% - -5%", min: -10, max: -5, segs: [] },
    { label: "-5%  -   5%", min: -5, max: 5, segs: [] },
    { label: "5%  -  10%", min: 5, max: 10, segs: [] },
    { label: "10% -  20%", min: 10, max: 20, segs: [] },
    { label: "20% -  30%", min: 20, max: 30, segs: [] },
    { label: "30% -  40%", min: 30, max: 40, segs: [] },
    { label: "40% -  50%", min: 40, max: 50, segs: [] },
    { label: "50% -    ", min: 50, max: Infinity, segs: [] },
  ];

  segments.forEach((seg) => {
    const grp = ranges.find(
      (r) => seg.net_rate >= r.min && seg.net_rate < r.max,
    );
    if (grp) grp.segs.push(seg);
  });

  const summary = ranges.map((r) => {
    const cnt = r.segs.length;
    if (!cnt) return { label: r.label, avg_net_rate: null, avg_pace: null };

    const avgRate = r.segs.reduce((s, x) => s + x.net_rate, 0) / cnt;

    // 合計距離・合計時間で平均ペースを算出
    const totalDist = r.segs.reduce((s, x) => s + x.dist_m, 0);
    const totalTime = r.segs.reduce((s, x) => s + x.duration_s, 0);
    const avgPace =
      totalTime > 0 && totalDist > 0
        ? totalTime / 60 / (totalDist / 1000)
        : null;

    return { label: r.label, avg_net_rate: avgRate, avg_pace: avgPace };
  });

  return { segments, summary };
}

function round2(val) {
  return val == null ? null : Math.round(val * 100) / 100;
}

function summarizeStats(stats) {
  const result = {
    total_distance_km: stats.distance_m ? round2(stats.distance_m / 1000) : null,
    total_ascent_m: round2(stats.total_gain_m),
    total_descent_m: round2(stats.total_loss_m),
    highest_elevation_m: round2(stats.highest_elevation_m),
    lowest_elevation_m: round2(stats.lowest_elevation_m),
  };
  const { segments } = analyzeSegments(stats, 1000);
  if (stats.trackpoints && stats.trackpoints.length > 1) {
    const times = stats.trackpoints.map(p => p[3]).filter(t => t != null);
    if (times.length >= 2) {
      const totalTime = (times[times.length - 1] - times[0]) / 1000;
      result.total_time_s = round2(totalTime);
      const h = Math.floor(totalTime / 3600);
      const m = Math.floor((totalTime % 3600) / 60);
      const s = Math.round((totalTime % 60) * 100) / 100;
      result.total_time_hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
      if (stats.distance_m) {
        result.average_pace_min_per_km = round2((totalTime / 60) / (stats.distance_m / 1000));
      }
    }
  }
  let maxPace = null;
  let minPace = null;
  let upDist = 0, downDist = 0, flatDist = 0;
  let upTime = 0, downTime = 0, flatTime = 0;
  let steepUp = 0, steepDown = 0;
  const pacePerKm = [];
  segments.forEach(seg => {
    if (seg.pace_min_per_km != null) {
      pacePerKm.push(seg.pace_min_per_km);
      if (maxPace === null || seg.pace_min_per_km < maxPace) maxPace = seg.pace_min_per_km;
      if (minPace === null || seg.pace_min_per_km > minPace) minPace = seg.pace_min_per_km;
    } else {
      pacePerKm.push(null);
    }
    const net = seg.net_rate;
    if (net > 0.5) {
      upDist += seg.dist_m;
      if (seg.duration_s) upTime += seg.duration_s;
    } else if (net < -0.5) {
      downDist += seg.dist_m;
      if (seg.duration_s) downTime += seg.duration_s;
    } else {
      flatDist += seg.dist_m;
      if (seg.duration_s) flatTime += seg.duration_s;
    }
    if (seg.up_rate >= 10) steepUp += 1;
    if (seg.down_rate >= 10) steepDown += 1;
  });
  result.max_pace_min_per_km = round2(maxPace);
  result.min_pace_min_per_km = round2(minPace);
  result.up_distance_km = round2(upDist / 1000);
  result.up_avg_pace_min_per_km = upTime > 0 ? round2((upTime / 60) / (upDist / 1000)) : null;
  result.down_distance_km = round2(downDist / 1000);
  result.down_avg_pace_min_per_km = downTime > 0 ? round2((downTime / 60) / (downDist / 1000)) : null;
  result.flat_distance_km = round2(flatDist / 1000);
  result.flat_avg_pace_min_per_km = flatTime > 0 ? round2((flatTime / 60) / (flatDist / 1000)) : null;
  result.steep_up_count = steepUp;
  result.steep_down_count = steepDown;
  const n = pacePerKm.length;
  let f5time = 0, f5dist = 0;
  for (let i = Math.max(0, n - 5); i < n; i++) {
    const seg = segments[i];
    f5time += seg.duration_s || 0;
    f5dist += seg.dist_m;
  }
  result.final5km_avg_pace_min_per_km = f5time > 0 ? round2((f5time / 60) / (f5dist / 1000)) : null;
  result.pace_per_km = pacePerKm.map(p => p == null ? null : round2(p));
  return result;
}
module.exports = {
  parseGpx,
  analyzeSlopeTime,
  analyzeSegments,
  summarizeStats,
};
