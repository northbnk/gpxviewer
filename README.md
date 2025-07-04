# GPX Viewer

Simple Node.js and Express application to upload a GPX file and show basic statistics.
The uploaded track is displayed on a Google Map and an elevation profile is rendered using Chart.js loaded from a CDN. Moving the mouse over either element highlights the corresponding position in the other.

## Usage

1. Install dependencies (Express, Multer, EJS):
   ```bash
   npm install
   ```
2. Run the server:
   ```bash
   node app.js
   ```
3. Open `http://localhost:5000` in your browser and upload a `.gpx` file.
