# GPX Viewer

Simple Node.js and Express application to upload a GPX file and show basic statistics.
The uploaded track is displayed on a Google Map and an elevation profile is rendered using Chart.js loaded from a CDN. Moving the mouse over either element highlights the corresponding position in the other.
It draws the track and an elevation profile using Chart.js loaded from a CDN.

## Usage

1. Install dependencies (Express, Multer, EJS):
   ```bash
   npm install
   ```
2. Set a Google Maps API key in the environment so the map can load. If the key is not provided the result page shows a warning and the map will not appear:
   ```bash
   export GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE
   ```
3. Run the server:
   ```bash
   node app.js
   ```
4. Open `http://localhost:5000` in your browser and upload a `.gpx` file.
