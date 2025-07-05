# GPX Viewer

Simple Node.js and Express application to upload a GPX file and show basic statistics.
The uploaded track is displayed on a Google Map and an elevation profile is rendered using Chart.js loaded from a CDN. Moving the mouse over either element highlights the corresponding position in the other.
It draws the track and an elevation profile using Chart.js loaded from a CDN.

## Usage

1. Install dependencies (Express, Multer, EJS):
   ```bash
   npm install
   ```
2. Set a Google Maps API key in the environment so the map can load. The key can be provided via the `GOOGLE_MAPS_API_KEY` variable (or the legacy `GOOGLEMAPS_API_KEY`). If the key is not present the result page shows a red warning and the map will not appear, but the elevation chart will still be drawn:
   ```bash
   export GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
   ```
3. Run the server (it listens on port 8180 by default):
   ```bash
   node app.js
   ```
4. Open `http://localhost:8180` in your browser and upload a `.gpx` file.

### Command line analysis

You can analyze a GPX file from the command line to measure the time spent on
steep climbs or descents. Provide thresholds in percent for the slope over each
kilometer:

```bash
node analyze.js path/to/file.gpx 10 10
```

The example above calculates how many seconds were spent on kilometers where the
uphill grade was at least 10% and where the downhill grade was at least 10%.
The result is printed as JSON.
