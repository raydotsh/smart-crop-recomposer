# Smart Crop Recomposer

An Adobe Express add-on that automatically reframes images using photography composition rules. Pick a layout style — Centered, Rule of Thirds, Cinematic, Text-Friendly, or Social Post — and the add-on detects the subject and adjusts the crop intelligently.

---

## Project Structure

```
smart-crop-recomposer/
├── backend/         # Express server + AI processing
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── routes/
│   │   └── recompose.js
│   └── services/
│       ├── detection.js   # TensorFlow.js subject detection
│       └── composition.js # Crop math for each layout
└── plugin/          # Adobe Express add-on (UXP)
    ├── manifest.json
    └── src/
        ├── index.html
        ├── main.js
        └── styles.css
```

There is also a standalone `frontend/` web app for testing without Adobe Express:

```
frontend/
├── index.html
├── styles.css
└── main.js
```

---

## Getting Started

### 1. Install backend dependencies

```bash
cd backend
npm install
```

> Note: `@tensorflow/tfjs-node` downloads native binaries at install time. This is expected and may take a few minutes.

### 2. Configure the environment

Edit `backend/.env` to set your port (default is `3000`):

```
PORT=3000
```

### 3. Start the backend

For production:
```bash
npm start
```

For local development (auto-restarts on save):
```bash
npm run dev
```

On startup the server will pre-load the TensorFlow COCO-SSD model so the first crop request is fast.

---

## Using the Adobe Express Plugin

1. Install [Adobe UXP Developer Tool](https://developer.adobe.com/express/add-ons/docs/guides/getting_started/local_development/).
2. In UXP Developer Tool, click **Add Plugin** and point it to `plugin/manifest.json`.
3. Load the plugin into Adobe Express.
4. Make sure the backend is running at `http://localhost:3000`.
5. Select an image on the canvas, choose a layout in the panel, and click **Recompose**.

---

## Using the Standalone Web Frontend

Start a local server from the project root:

```bash
npx serve frontend
```

Then open the URL shown in your terminal (usually `http://localhost:3000` or similar). You can drag and drop or browse for an image, choose a layout, and hit **Recompose Image**.

---

## Layouts

| Layout | Aspect Ratio | Description |
|---|---|---|
| Centered | Original | Subject centered in the frame |
| Rule of Thirds | Original | Subject at the nearest third-line intersection |
| Cinematic | 16:9 | Subject slightly off-center, wide negative space |
| Text-Friendly | 16:9 | Subject pushed to one side, space left for headlines |
| Social Post | 1:1 | Square crop, subject centered — great for Instagram |

---

## Error States

| Error | Handled In | Behavior |
|---|---|---|
| No image selected | Plugin `main.js` | Shows friendly message |
| Non-image file uploaded | `recompose.js` fileFilter | Returns 400 with helpful message |
| File too large (>15MB) | `recompose.js` multer limits | Returns 400 |
| Backend unavailable | Plugin/frontend JS | Shows connection error |
| No subject detected | `detection.js` → `composition.js` | Falls back to centered crop |
| Fetch timeout (>30s) | Plugin `main.js` | Aborts request, shows error |

---

## Tech Stack

- **Backend**: Node.js, Express, Multer, Sharp, TensorFlow.js (COCO-SSD)
- **Plugin**: Vanilla JS/HTML/CSS, Adobe UXP SDK
- **Frontend**: Vanilla JS/HTML/CSS (glassmorphism dark UI)
