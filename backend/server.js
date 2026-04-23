require("dotenv").config();

const express = require("express");
const cors = require("cors");

const recomposeRouter = require("./routes/recompose");
const { warmUp } = require("./services/detection");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: true,
    credentials: false
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "smart-crop-recomposer-backend" });
});

app.use("/recompose", recomposeRouter);

app.use((error, _request, response, _next) => {
  console.error("Unhandled server error:", error);
  response.status(500).json({
    error: "Internal server error"
  });
});

app.listen(port, async () => {
  console.log(`Smart Crop Recomposer backend listening on http://localhost:${port}`);
  await warmUp();
});
