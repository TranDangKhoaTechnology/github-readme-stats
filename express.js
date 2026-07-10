import "dotenv/config";
import statsCard from "./api/index.js";
import repoCard from "./api/pin.js";
import langCard from "./api/top-langs.js";
import wakatimeCard from "./api/wakatime.js";
import gistCard from "./api/gist.js";
import {
  getRenderSchedulerStatus,
  startRenderBackgroundScheduler,
  stopRenderBackgroundScheduler,
} from "./src/render-background-scheduler.js";
import express from "express";

const app = express();
const router = express.Router();

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "GitHub Readme Stats",
    maintainer: "TranDangKhoaTechnology",
    status: "online",
    endpoints: {
      stats: "/api?username=<github-username>",
      languages: "/api/top-langs?username=<github-username>",
      repository: "/api/pin?username=<github-username>&repo=<repository>",
      gist: "/api/gist?id=<gist-id>",
      wakatime: "/api/wakatime?username=<wakatime-username>",
      health: "/health",
      schedulerHealth: "/health/scheduler",
    },
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/scheduler", (_req, res) => {
  res.status(200).json(getRenderSchedulerStatus());
});

router.get("/", statsCard);
router.get("/pin", repoCard);
router.get("/top-langs", langCard);
router.get("/wakatime", wakatimeCard);
router.get("/gist", gistCard);

app.use("/api", router);

const port = process.env.PORT || 9000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  startRenderBackgroundScheduler();
});

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log("[server] " + signal + " received; shutting down");
  stopRenderBackgroundScheduler();

  const forceShutdownTimer = setTimeout(() => {
    console.error("[server] forced shutdown after timeout");
    process.exit(1);
  }, 30_000);
  forceShutdownTimer.unref();

  server.close((error) => {
    clearTimeout(forceShutdownTimer);
    if (error) {
      console.error("[server] shutdown failed", error);
      process.exitCode = 1;
      return;
    }

    console.log("[server] shutdown complete");
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
