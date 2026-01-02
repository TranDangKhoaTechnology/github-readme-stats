// scripts/pins.mjs
// Usage:
// node scripts/pins.mjs --owner TranDangKhoaTechnology --dark_theme blue-green --light_theme solarized-light --outdir generated/pins

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

function safeName(s) {
  return String(s).replaceAll("/", "__");
}

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exitCode = r.status || 1;
}

async function main() {
  const owner = arg("owner", "TranDangKhoaTechnology");
  const darkTheme = arg("dark_theme", "blue-green");
  const lightTheme = arg("light_theme", "solarized-light");
  const outdir = arg("outdir", "generated/pins");

  const jsonPath = path.join(process.cwd(), "scripts", "pins.json");
  const repos = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  fs.mkdirSync(outdir, { recursive: true });

  for (const repo of repos) {
    const base = safeName(repo);

    run(
      "node",
      [
        "scripts/pin-card.mjs",
        "--owner",
        owner,
        "--repo",
        repo,
        "--theme",
        darkTheme,
        "--out",
        path.join(outdir, `${base}.dark.svg`),
        "--show",
        "stars,forks,language,updated",
      ],
      {}
    );

    run(
      "node",
      [
        "scripts/pin-card.mjs",
        "--owner",
        owner,
        "--repo",
        repo,
        "--theme",
        lightTheme,
        "--out",
        path.join(outdir, `${base}.light.svg`),
        "--show",
        "stars,forks,language,updated",
      ],
      {}
    );
  }
}

main();
