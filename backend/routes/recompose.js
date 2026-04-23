const express = require("express");
const multer = require("multer");
const sharp = require("sharp");

const { detectSubject } = require("../services/detection");
const { calculateCrop } = require("../services/composition");

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/tiff"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter(_request, file, callback) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Unsupported file type: ${file.mimetype}. Upload a JPEG, PNG or WebP image.`));
    }
  }
});

function clampDimension(value, max) {
  return Math.max(1, Math.min(Math.round(value), max));
}

function toPixelBox(normalizedBox, imageWidth, imageHeight) {
  if (!normalizedBox) {
    return null;
  }

  const x = normalizedBox.x * imageWidth;
  const y = normalizedBox.y * imageHeight;
  const width = normalizedBox.width * imageWidth;
  const height = normalizedBox.height * imageHeight;

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: clampDimension(width, imageWidth),
    height: clampDimension(height, imageHeight)
  };
}

router.post(
  "/",
  (request, response, next) => {
    upload.single("image")(request, response, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return response.status(400).json({ error: "File too large. Maximum upload size is 15MB." });
        }
        return response.status(400).json({ error: err.message });
      }
      if (err) {
        return response.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (request, response) => {
    if (!request.file || !request.file.buffer) {
      return response.status(400).json({ error: "Image upload is required." });
    }

    const layout = String(request.body.layout || "centered").trim().toLowerCase();
    const intent = String(request.body.intent || "").trim().toLowerCase();

    try {
      const image = sharp(request.file.buffer, { failOn: "none" });
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return response.status(400).json({ error: "Could not read image metadata." });
      }

      const imageWidth = metadata.width;
      const imageHeight = metadata.height;
      const sourceFormat = metadata.format === "png" ? "png" : "jpeg";

      let detectionBox = null;
      try {
        detectionBox = await detectSubject(request.file.buffer);
      } catch (detectionError) {
        console.error("Detection failed, falling back to default crop:", detectionError);
      }

      const crop = calculateCrop({
        imageWidth,
        imageHeight,
        bbox: toPixelBox(detectionBox, imageWidth, imageHeight),
        layout,
        intent
      });

      const pipeline = sharp(request.file.buffer, { failOn: "none" }).extract(crop);
      const longestEdge = Math.max(crop.width, crop.height);

      if (longestEdge > 1024) {
        pipeline.resize({
          width: crop.width >= crop.height ? 1024 : null,
          height: crop.height > crop.width ? 1024 : null,
          fit: "inside",
          withoutEnlargement: true
        });
      }

      const outputBuffer =
        sourceFormat === "png"
          ? await pipeline.png().toBuffer()
          : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();

      response.setHeader("Content-Type", sourceFormat === "png" ? "image/png" : "image/jpeg");
      return response.send(outputBuffer);
    } catch (error) {
      console.error("Recompose request failed:", error);
      return response.status(500).json({ error: "Image processing failed." });
    }
  }
);

module.exports = router;
