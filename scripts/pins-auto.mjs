// scripts/pins-auto.mjs
// Node 20+
// Generate pins for ALL repos (dark + light), no JSON needed.
//
// Example:
// node scripts/pins-auto.mjs --owner TranDangKhoaTechnology --out_dir generated/pins --theme_dark tokyonight --theme_light solarized-light --max_repos 500 --include_forks false
//
// Options:
// --owner / --username
// --out_dir (default generated/pins)
// --theme_dark (default tokyonight)
// --theme_light (default solarized-light)
// --max_repos (default 500)
// --include_forks (default false)
// --exclude_repo "repo1,repo2"
// --sort updated|pushed|stars  (default updated)
// --show / --hide (forward to pin-card.mjs)

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
function argInt(name, fallback) {
  const v = arg(name, null);
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}
function argBool(name, fallback = false) {
  const v = arg(name, null);
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}
function listLowerCSV(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function gh(url) {
  const token = process.env.GITHUB_TOKEN || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "readme-cards",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${t.slice(0, 220)}`);
  }
  return res.json();
}

async function fetchRepos(owner, maxRepos, includeForks, excludeSet, sort) {
  const per = 100;
  let page = 1;
  const repos = [];

  const apiSort = sort === "pushed" ? "pushed" : "updated";

  while (repos.length < maxRepos) {
    const url = `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=${per}&page=${page}&sort=${apiSort}&direction=desc`;
    const batch = await gh(url);
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      if (!includeForks && r.fork) continue;
      if (r.archived) continue;
      const name = String(r.name || "");
      if (!name) continue;
      if (excludeSet.has(name.toLowerCase())) continue;

      repos.push({
        name,
        stars: r.stargazers_count ?? 0,
        updated_at: r.updated_at || "",
      });

      if (repos.length >= maxRepos) break;
    }
    page++;
  }

  if (sort === "stars") repos.sort((a, b) => (b.stars - a.stars) || String(b.updated_at).localeCompare(String(a.updated_at)));

  return repos.map((r) => r.name);
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function shQuote(s) {
  // safe for bash on ubuntu runner
  return `"${String(s).replaceAll('"', '\\"')}"`;
}

async function main() {
  const owner = arg("owner", arg("username", "TranDangKhoaTechnology"));
  const outDir = arg("out_dir", "generated/pins");
  const themeDark = arg("theme_dark", "tokyonight");
  const themeLight = arg("theme_light", "solarized-light");
  const maxRepos = argInt("max_repos", 500);
  const includeForks = argBool("include_forks", false);
  const sort = String(arg("sort", "updated")).toLowerCase();
  const show = arg("show", "stars,forks,issues,watchers,language,license,topics,updated,size");
  const hide = arg("hide", "");
  const excludeSet = new Set(listLowerCSV(arg("exclude_repo", "")));

  fs.mkdirSync(outDir, { recursive: true });

  const repoNames = await fetchRepos(owner, maxRepos, includeForks, excludeSet, sort);

  const limit = 4; // giảm để tránh rate-limit
  await mapLimit(repoNames, limit, async (repo) => {
    const safe = repo.replaceAll("/", "-");
    const outDark = path.join(outDir, `${safe}.dark.svg`);
    const outLight = path.join(outDir, `${safe}.light.svg`);

    try {
      execSync(
        `node scripts/pin-card.mjs --owner ${shQuote(owner)} --repo ${shQuote(repo)} --theme ${shQuote(themeDark)} --show ${shQuote(show)} --hide ${shQuote(hide)} --out ${shQuote(outDark)}`,
        { stdio: "inherit" }
      );
      execSync(
        `node scripts/pin-card.mjs --owner ${shQuote(owner)} --repo ${shQuote(repo)} --theme ${shQuote(themeLight)} --show ${shQuote(show)} --hide ${shQuote(hide)} --out ${shQuote(outLight)}`,
        { stdio: "inherit" }
      );
    } catch (e) {
      console.error(`[pin fail] ${repo}: ${String(e?.message || e)}`);
      // không fail cả job
    }
  });

  console.log(`Done. Generated pins for ${repoNames.length} repos into ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
