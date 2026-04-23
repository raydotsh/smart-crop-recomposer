# Smart Crop Recomposer

Implementation brief for a coding agent or developer.

## Goal

Build a production-ready Adobe Express add-on that automatically reframes images using photography-inspired composition rules such as centered framing, rule of thirds, cinematic framing, and text-friendly layouts.

The solution has two parts:

1. A plugin that runs inside Adobe Express.
2. A backend service that performs image analysis and cropping.

The plugin sends the selected image and layout choice to the backend. The backend analyzes the image, computes a crop, returns the processed result, and the plugin replaces the original image on the canvas.

## High-Level Architecture

```text
Adobe Express
  -> Plugin panel (HTML/CSS/JS in UXP sandbox)
  -> User selects image and clicks Recompose
  -> Plugin sends HTTP POST with image + layout
  -> Backend server receives request
  -> Detection service finds subject
  -> Composition service computes crop region
  -> Sharp crops and encodes output image
  -> Backend returns processed image
  -> Plugin replaces selected image on canvas
```

## Required Project Structure

```text
smart-crop-recomposer/
|-- plugin/
|   |-- manifest.json
|   `-- src/
|       |-- index.html
|       |-- main.js
|       `-- styles.css
`-- backend/
    |-- server.js
    |-- package.json
    |-- routes/
    |   `-- recompose.js
    `-- services/
        |-- detection.js
        `-- composition.js
```

## What To Build

### `plugin/manifest.json`

Create a valid Adobe Express add-on manifest that:

- Uses `manifestVersion: 2`
- Defines a unique plugin `id`
- Sets the display `name` to `Smart Crop Recomposer`
- Includes a valid semantic `version`
- Declares Adobe Express requirements
- Registers one panel entry point
- Points the panel entry point to `src/index.html`
- Requests permissions required for:
  - document/canvas access
  - network access to the backend

If the manifest is invalid, the plugin will not load in Adobe UXP Developer Tool.

### `plugin/src/index.html`

Build a narrow control panel UI containing:

- A control to work with the currently selected image
- A layout dropdown with:
  - Centered
  - Rule of Thirds
  - Cinematic
  - Text-Friendly
- A `Recompose` action button
- A loading indicator
- A status or error message area

Keep the markup simple and compatible with the UXP environment.

### `plugin/src/styles.css`

Add clean panel styling that:

- Fits a narrow Adobe Express side panel
- Spaces controls clearly
- Styles buttons, select input, and status area
- Includes a simple spinner or loading treatment
- Feels close to Adobe Express styling without requiring a heavy UI framework

### `plugin/src/main.js`

Implement the panel logic:

1. Read the selected node from the Adobe Express canvas using the add-on SDK.
2. Validate that the selection is an image.
3. Export or read the selected image as bytes/blob.
4. Build a `FormData` payload with:
   - `image`
   - `layout`
5. `POST` the payload to `http://localhost:3000/recompose`
6. Show loading state while the request is in progress.
7. Receive the processed image response.
8. Replace the original selected image with the processed result.
9. Show friendly error messages for failure cases.

Handle at least these cases:

- no image selected
- backend unavailable
- invalid backend response
- replace-on-canvas failure

## Backend Requirements

### `backend/server.js`

Create an Express server that:

- Loads environment configuration if needed
- Enables CORS
- Uses JSON middleware where appropriate
- Mounts the recompose route
- Starts on port `3000` by default
- Logs a startup message

### `backend/routes/recompose.js`

Create `POST /recompose` that:

- Accepts multipart image uploads using `multer`
- Stores uploaded files in memory
- Reads the `layout` field from the request body
- Calls the detection service
- Calls the composition service
- Uses `sharp` to crop the original image
- Returns the processed image buffer with the correct content type

Error handling:

- Return `400` if no image is uploaded
- Fall back to centered behavior if detection fails
- Return `500` for processing failures

### `backend/services/detection.js`

Implement subject detection using TensorFlow.js and `coco-ssd`.

Requirements:

- Load the model once and reuse it across requests
- Accept an image buffer
- Decode the image into a TensorFlow-compatible tensor
- Run object detection
- Prefer the `person` class when present
- Otherwise choose the highest-confidence object
- Return a normalized bounding box:

```js
{ x, y, width, height }
```

All values should be normalized between `0` and `1`.

If nothing useful is detected, return `null`.

### `backend/services/composition.js`

Implement crop math for the following layout types:

- `centered`
- `rule-of-thirds`
- `cinematic`
- `text-friendly`

Inputs:

- image width
- image height
- detected bounding box
- selected layout
- optional target aspect ratio

Output:

```js
{ left, top, width, height }
```

Rules for each layout:

#### Centered

- Center the crop around the subject midpoint.
- Keep the subject visually centered.

#### Rule of Thirds

- Use a 3x3 grid.
- Align the subject near the closest intersection point.

#### Cinematic

- Prefer a wide aspect ratio such as `2.39:1` or `16:9`.
- Place the subject slightly off-center.
- Preserve more horizontal negative space.

#### Text-Friendly

- Push the subject to one side.
- Preserve the opposite side as usable negative space.
- Prefer the side that leaves more room for text overlay.

All crop outputs must:

- stay inside image bounds
- clamp invalid values
- avoid zero or negative dimensions

Fallback behavior:

- If there is no detection result, use a centered crop based on the image midpoint.

### `backend/package.json`

Create a package file with:

#### Scripts

```json
{
  "start": "node server.js"
}
```

#### Dependencies

- `express`
- `cors`
- `multer`
- `sharp`
- `@tensorflow/tfjs-node`
- `@tensorflow-models/coco-ssd`

Note: `@tensorflow/tfjs-node` is large and downloads native binaries during install. That is expected.

## End-to-End Data Flow

```text
1. User selects an image in Adobe Express.
2. User opens the Smart Crop Recomposer panel.
3. User chooses a layout.
4. User clicks Recompose.
5. Plugin reads the selected image.
6. Plugin sends multipart form data to POST /recompose.
7. Backend parses the upload into memory.
8. Detection service returns a subject bounding box or null.
9. Composition service computes crop coordinates.
10. Sharp applies the crop and encodes output.
11. Backend returns the processed image.
12. Plugin replaces the selected image on the Adobe Express canvas.
```

## Technical Constraints

| Constraint | Reason |
|---|---|
| Process images at or below about 1024px where practical | Improves TensorFlow inference speed |
| Load the detection model once | Avoid slow per-request initialization |
| Use in-memory uploads with multer | Simpler and faster than disk temp files |
| Use `fetch()` from the plugin | Best fit for the UXP environment |
| Avoid React, Next.js, or build-heavy tooling | Keep the plugin compatible with UXP |
| Enable CORS on the backend | Plugin and backend run on different origins |

## Plugin Loading

To load the plugin locally:

1. Install Adobe UXP Developer Tool.
2. Add the plugin by pointing to `plugin/manifest.json`.
3. Load the plugin into Adobe Express.
4. Start the backend separately from `backend/` using `node server.js`.

## Required Error States

| Error | Where to handle | Expected behavior |
|---|---|---|
| No image selected | `plugin/src/main.js` | Show a user-friendly message |
| Backend unavailable | `plugin/src/main.js` | Show connection failure message |
| No subject detected | backend route/services | Fall back to centered crop |
| Image too small to crop well | `composition.js` | Return original or safe crop |
| Model load failure | `detection.js` | Log it and return `null` |
| Out-of-bounds crop math | `composition.js` | Clamp values safely |

## Optional Enhancements

### Output Format Presets

Support an additional `format` field such as:

- `square`
- `portrait`
- `landscape`
- `story`

Each preset can map to a target aspect ratio.

### Padding

After crop, optionally resize or pad the output with:

- white background
- blurred image background

## Recommended Build Order

1. Create the backend server and `POST /recompose`.
2. Add `sharp` cropping with a simple center crop fallback.
3. Implement detection service and model caching.
4. Implement composition logic for all layouts.
5. Build the plugin manifest and panel UI.
6. Connect the plugin to the backend.
7. Implement canvas image replacement.
8. Test all failure states.

## Final Delivery Criteria

The project is complete when:

- The backend starts successfully with `node server.js`
- The plugin loads in Adobe UXP Developer Tool without manifest errors
- A selected image can be sent from Adobe Express to the backend
- The backend returns a processed image
- The plugin replaces the selected canvas image with the processed result
- All four layout types work with reasonable fallback behavior
- No placeholder or pseudo-code remains in the implementation
