from flask import Flask, request, render_template
from gpxutils import parse_gpx

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'gpxfile' not in request.files:
        return 'No file part', 400
    file = request.files['gpxfile']
    if file.filename == '':
        return 'No selected file', 400
    stats = parse_gpx(file)
    return render_template('result.html', stats=stats)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
