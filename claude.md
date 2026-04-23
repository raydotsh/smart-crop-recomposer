# Frontend Instructions for Claude

You are tasked with building the frontend for the **Smart Crop Recomposer**, an Adobe Express add-on. 

The backend architecture and server are already complete. As detailed in `backend/FRONTEND_EXPLANATION.md` and `backend/implement.md`, a frontend plugin is absolutely required for users to interact with this tool inside Adobe Express.

## Requirements

You must create the `plugin/` folder and implement the frontend add-on without heavy build tools (Vanilla JS/HTML/CSS preferred).

### 1. `plugin/manifest.json`
- Manifest Version 2.
- Give it an ID like `com.smartcrop.recomposer`.
- Request permissions exactly for `document` (`readAndWrite`) and `network` (`http://localhost:3000`).
- The entry point should be a panel pointing to `src/index.html`.

### 2. `plugin/src/index.html`
- A panel UI with a layout dropdown (Centered, Rule of Thirds, Cinematic, Text-Friendly).
- A "Recompose" button.
- Status and loading text areas.

### 3. `plugin/src/styles.css`
- A clean, narrow layout matching Adobe Express's UI guidelines.

### 4. `plugin/src/main.js`
- Connect to the Adobe Express SDK.
- Create an action to read the user's currently selected image.
- Create a `FormData` object containing the image binary and the selected layout.
- Send a `POST` request using `fetch` to `http://localhost:3000/recompose`.
- Once the processed image is returned, seamlessly replace the original image on the Adobe Express canvas with it.
- Implement robust error handling (no image selected, backend offline, server error).

You should provide the complete code for these 4 files.
