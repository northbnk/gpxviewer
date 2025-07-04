import gpxutils


def test_parse():
    with open('testdata/sample.gpx') as f:
        stats = gpxutils.parse_gpx(f)
    assert stats['points'] == 2
    assert round(stats['distance_m'], 1) > 0
    assert len(stats['trackpoints']) == 2
