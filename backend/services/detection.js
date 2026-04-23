const tf = require("@tensorflow/tfjs");
const cocoSsd = require("@tensorflow-models/coco-ssd");
const { loadSharp } = require("./sharp-loader");

const sharp = loadSharp();

let modelPromise = null;

// Call this at server startup to avoid cold-start delay on first request.
async function warmUp() {
  console.log("Warming up TensorFlow model...");
  try {
    await getModel();
    console.log("TensorFlow model ready.");
  } catch (err) {
    console.error("Model warm-up failed (will retry on first request):", err.message);
  }
}

async function getModel() {
  if (!modelPromise) {
    modelPromise = cocoSsd.load().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

function normalizeBox(bbox, imageWidth, imageHeight) {
  const [x, y, width, height] = bbox;
  if (!imageWidth || !imageHeight || width <= 0 || height <= 0) {
    return null;
  }

  const left = Math.max(0, Math.min(x / imageWidth, 1));
  const top = Math.max(0, Math.min(y / imageHeight, 1));
  const normalizedWidth = Math.max(0, Math.min(width / imageWidth, 1 - left));
  const normalizedHeight = Math.max(0, Math.min(height / imageHeight, 1 - top));

  return {
    x: left,
    y: top,
    width: normalizedWidth,
    height: normalizedHeight
  };
}

async function detectSubject(imageBuffer) {
  try {
    const model = await getModel();
    const { data, info } = await sharp(imageBuffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);

    try {
      const predictions = await model.detect(tensor);
      if (!predictions.length) {
        return null;
      }

      const ranked = predictions
        .filter((prediction) => prediction.score >= 0.4 && Array.isArray(prediction.bbox))
        .sort((left, right) => {
          if (left.class === "person" && right.class !== "person") {
            return -1;
          }
          if (left.class !== "person" && right.class === "person") {
            return 1;
          }
          return right.score - left.score;
        });

      if (!ranked.length) {
        return null;
      }

      return normalizeBox(ranked[0].bbox, tensor.shape[1], tensor.shape[0]);
    } finally {
      tensor.dispose();
    }
  } catch (error) {
    console.error("Detection service error:", error);
    return null;
  }
}

module.exports = {
  detectSubject,
  warmUp
};
