import xml.etree.ElementTree as ET
import math


def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def parse_gpx(fp):
    tree = ET.parse(fp)
    root = tree.getroot()
    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
    trackpoints = []
    for trkpt in root.findall('.//gpx:trkpt', ns):
        lat = float(trkpt.attrib.get('lat'))
        lon = float(trkpt.attrib.get('lon'))
        trackpoints.append((lat, lon))

    stats = {
        'points': len(trackpoints),
    }
    if trackpoints:
        lats = [p[0] for p in trackpoints]
        lons = [p[1] for p in trackpoints]
        stats['bounds'] = {
            'min_lat': min(lats),
            'max_lat': max(lats),
            'min_lon': min(lons),
            'max_lon': max(lons),
        }
        dist = 0
        for i in range(1, len(trackpoints)):
            dist += haversine(trackpoints[i-1][0], trackpoints[i-1][1], trackpoints[i][0], trackpoints[i][1])
        stats['distance_m'] = dist
    return stats
