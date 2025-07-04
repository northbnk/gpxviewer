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
  const regex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    trackpoints.push([parseFloat(match[1]), parseFloat(match[2])]);
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
    for (let i = 1; i < trackpoints.length; i++) {
      dist += haversine(trackpoints[i-1][0], trackpoints[i-1][1], trackpoints[i][0], trackpoints[i][1]);
    }
    stats.distance_m = dist;
  }
  return stats;
}

module.exports = { parseGpx };
