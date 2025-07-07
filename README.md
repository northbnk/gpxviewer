# GPX Viewer

Simple Node.js and Express application to upload a GPX file and show basic statistics.
The uploaded track is displayed on a Google Map and an elevation profile is rendered using Chart.js loaded from a CDN. Moving the mouse over either element highlights the corresponding position in the other.
It draws the track and an elevation profile using Chart.js loaded from a CDN.
Waypoints contained in the GPX file are automatically displayed on the map and on the elevation chart.

## Usage

1. Install dependencies (Express, Multer, EJS, dotenv):
   ```bash
   npm install
   ```
2. Set a Google Maps API key in the environment so the map can load. You can
   place it in a `.env` file or export it as `GOOGLE_MAPS_API_KEY` (the legacy
   `GOOGLEMAPS_API_KEY` is also supported). If the key is absent the result page
   shows a red warning and the map will not appear, but the elevation chart will
   still be drawn:
   ```bash
   echo GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE > .env
   ```
3. Run the server (it listens on port 8180 by default):
   ```bash
   node app.js
   ```
4. Open `http://localhost:8180` in your browser. Drop a `.gpx` file onto the page
   or use the file picker at the top to upload it. The page then displays various
   statistics and provides a button to download the JSON summary.
5. (Optional) To generate a textual analysis of the uploaded track using GPT,
   set `OPENAI_API_KEY` in the environment. A "Generate Text Report" button
   appears on the result page and will call the OpenAI API to create a short
   report describing the run.

### Command line analysis

You can analyze a GPX file from the command line to measure the time spent on
steep climbs or descents. Provide thresholds in percent for the slope over each
kilometer:

```bash
node analyze.js path/to/file.gpx 10 10
```

The example above calculates how many seconds were spent on kilometers where the
uphill grade was at least 10% and where the downhill grade was at least 10%.
The result is printed as JSON. The same analysis is available in the web
interface via the upload form.
