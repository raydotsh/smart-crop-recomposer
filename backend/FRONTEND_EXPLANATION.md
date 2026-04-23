# Do You Need a Frontend?

Yes, for this project you do need a frontend.

## Short Answer

This project is not just a backend image-processing API. It is an Adobe Express add-on, which means it needs:

1. A frontend plugin that runs inside Adobe Express
2. A backend server that processes images

If you only build the backend, you will have an API that can crop images, but you will not have the Adobe Express panel that users interact with.

## What the Frontend Does

The frontend is the `plugin/` part of the project.

Its job is to:

- show the UI inside Adobe Express
- let the user choose a layout style
- detect which image is selected on the canvas
- send that image to the backend
- receive the processed image
- replace the original image on the canvas

Without the frontend, the user has no way to use the feature inside Adobe Express.

## What the Backend Does

The backend is the `backend/` part of the project.

Its job is to:

- receive the uploaded image
- detect the main subject
- calculate the best crop
- apply the crop
- return the new image

The backend does the heavy processing, but it does not provide the Adobe Express user experience.

## Why Both Are Needed

Think of it like this:

- the frontend is the control panel
- the backend is the processing engine

The frontend collects the user action.
The backend performs the actual work.

This project only feels complete when both parts are connected.

## When You Would Not Need a Frontend

You would not need the Adobe Express frontend only if your goal changed to something else, such as:

- a simple REST API for image cropping
- a command-line image processing tool
- a test-only backend used by Postman or curl

In those cases, the backend alone would be enough.

## For This Project Specifically

Because the brief says the tool must work as an Adobe Express add-on, the frontend is required.

Minimum frontend needed:

- `manifest.json`
- `index.html`
- `main.js`
- `styles.css`

That is enough to create a usable panel UI and connect it to the backend.

## Final Conclusion

Yes, you need a frontend for this project.

The backend alone can process images, but the frontend is what makes it usable inside Adobe Express.
