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

function parseGpx(text) {
  const trackpoints = [];
  const regex = /<trkpt\b([^>]*)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const attrs = match[1];
    const content = match[2] || '';
    const latMatch = /lat="([^"]+)"/.exec(attrs);
    const lonMatch = /lon="([^"]+)"/.exec(attrs);
    if (!latMatch || !lonMatch) continue;
    let ele = null;
    const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(content);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    trackpoints.push([parseFloat(latMatch[1]), parseFloat(lonMatch[1]), ele]);
  }
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
    let dist = 0;
    const perKm = [];
    const profile = [[0, trackpoints[0][2]]];
    for (let i = 1; i < trackpoints.length; i++) {
      const kmIndex = Math.floor(dist / 1000);
      if (!perKm[kmIndex]) {
        perKm[kmIndex] = { km: kmIndex + 1, gain: 0, loss: 0 };
      }
      const ele1 = trackpoints[i-1][2];
      const ele2 = trackpoints[i][2];
      if (ele1 != null && ele2 != null) {
        const diff = ele2 - ele1;
        if (diff > 0) perKm[kmIndex].gain += diff; else perKm[kmIndex].loss += -diff;
      }
      dist += haversine(trackpoints[i-1][0], trackpoints[i-1][1], trackpoints[i][0], trackpoints[i][1]);
      profile.push([dist, trackpoints[i][2]]);
    }
    stats.distance_m = dist;
    stats.per_km_elevation = perKm;
    stats.profile = profile;
  }
  stats.trackpoints = trackpoints;
  return stats;
}

module.exports = { parseGpx };
