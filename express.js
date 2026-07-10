import "dotenv/config";
import statsCard from "./api/index.js";
import repoCard from "./api/pin.js";
import langCard from "./api/top-langs.js";
import wakatimeCard from "./api/wakatime.js";
import gistCard from "./api/gist.js";
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
    },
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/", statsCard);
router.get("/pin", repoCard);
router.get("/top-langs", langCard);
router.get("/wakatime", wakatimeCard);
router.get("/gist", gistCard);

app.use("/api", router);

const port = process.env.PORT || 9000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
