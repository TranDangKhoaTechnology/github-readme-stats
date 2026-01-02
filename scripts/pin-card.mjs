// scripts/pin-card.mjs
// Node 20+
// Example:
// node scripts/pin-card.mjs --owner TranDangKhoaTechnology --repo FaceAutoVN --theme tokyonight --out generated/pins/FaceAutoVN.dark.svg
//
// Options:
// --owner / --username
// --repo (required)
// --theme (default: tokyonight)
// --out  (required)
// --show (default: "stars,forks,issues,watchers,language,license,topics,updated,size")
// --hide (default: "")  // owner,desc,topics,footer

import fs from "node:fs";
import path from "node:path";
import {
  esc, fmtCompact, toDateShort, wrapLines, estTextW,
  langColor, listLowerCSV, resolveTheme, clampRepoTitle
} from "./theme.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

export async function gh(url) {
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

function chip({ x, y, text, t, colorDot = null }) {
  const fs = 11;
  const padX = 10;
  const h = 22;
  const dotW = colorDot ? 12 : 0;
  const w = Math.ceil(dotW + padX * 2 + estTextW(text, fs));

  const dot = colorDot
    ? `<circle cx="${x + 10}" cy="${y + 11}" r="5" fill="${colorDot}" />`
    : "";

  const tx = x + padX + (colorDot ? 12 : 0);

  return {
    w,
    svg: `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${t.chipBg}" stroke="rgba(255,255,255,0.06)"/>
        ${dot}
        <text x="${tx}" y="${y + 15}" font-size="${fs}" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>
      </g>
    `,
  };
}

export function renderPinCard({ owner, repo, themeName, data, show, hide }) {
  const t = resolveTheme(themeName);
  const W = 495;
  const PAD = 16;
  const GAP = 8;

  const full = `${owner}/${repo}`;
  const title = clampRepoTitle(repo);

  const descLines = hide.includes("desc") ? [] : wrapLines(data.description || "", 62, 2);
  const topics = (Array.isArray(data.topics) ? data.topics : []).slice(0, 3);

  const lang = data.language || "—";
  const langDot = langColor(lang);

  const pieces = [];

  if (show.includes("stars")) pieces.push(`★ ${fmtCompact(data.stargazers_count)}`);
  if (show.includes("forks")) pieces.push(`⑂ ${fmtCompact(data.forks_count)}`);
  if (show.includes("issues")) pieces.push(`! ${fmtCompact(data.open_issues_count)}`);
  if (show.includes("watchers")) pieces.push(`👁 ${fmtCompact(data.subscribers_count ?? data.watchers_count ?? 0)}`);
  if (show.includes("language")) pieces.push(`Lang ${lang}`);
  if (show.includes("license")) pieces.push(`Lic ${(data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION") ? data.license.spdx_id : "—"}`);
  if (show.includes("size")) pieces.push(`Size ${fmtCompact((data.size ?? 0))}KB`);
  if (show.includes("updated")) pieces.push(`↻ ${toDateShort(data.pushed_at || data.updated_at)}`);

  // ===== layout compute =====
  let y = 16;
  const headerH = hide.includes("owner") ? 28 : 42;
  const descH = descLines.length ? (descLines.length * 16 + 6) : 0;
  const topicsH = (!hide.includes("topics") && show.includes("topics") && topics.length) ? 26 : 0;

  const defs = `
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bg}" />
      <stop offset="100%" stop-color="${t.bg2 || t.bg}" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1 || t.title}" />
      <stop offset="100%" stop-color="${t.grad2 || t.accent}" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${t.shadow}"/>
    </filter>
  </defs>`;

  let body = `
  <g transform="translate(${PAD},${y})">
    <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.07)"/>
    <text x="10" y="14" text-anchor="middle" font-size="12" fill="${t.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>

    <text x="30" y="14" font-size="${title.size}" font-weight="900" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(title.text)}</text>
    ${hide.includes("owner") ? "" : `<text x="30" y="32" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(owner)}</text>`}
    <text x="${W - PAD * 2}" y="14" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(full)}</text>
  </g>`;

  y += headerH;

  // description
  if (descLines.length) {
    const baseY = y;
    for (let i = 0; i < descLines.length; i++) {
      body += `<text x="${PAD}" y="${baseY + 14 + i * 16}" font-size="12" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(descLines[i])}</text>`;
    }
    y += descH;
  }

  // topics chips
  if (!hide.includes("topics") && show.includes("topics") && topics.length) {
    let x = PAD;
    const ty = y;
    for (const topic of topics) {
      const c = chip({ x, y: ty, text: `#${topic}`, t });
      if (x + c.w > W - PAD) break;
      body += c.svg;
      x += c.w + GAP;
    }
    y += topicsH;
  }

  // divider
  body += `<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="1" fill="${t.track}" opacity="0.9"/>`;
  y += 12;

  // stats chips (wrap max 2 rows)
  let cx = PAD, cy = y, row = 1;
  const chipRowsMax = 2;
  const chipH = 22, chipRowGap = 8;

  for (const p of pieces) {
    const isLang = p.startsWith("Lang ");
    const c = chip({ x: cx, y: cy, text: p, t, colorDot: isLang ? langDot : null });
    if (cx + c.w > W - PAD) {
      row++;
      if (row > chipRowsMax) break;
      cx = PAD;
      cy += chipH + chipRowGap;
      const c2 = chip({ x: cx, y: cy, text: p, t, colorDot: isLang ? langDot : null });
      if (cx + c2.w > W - PAD) continue;
      body += c2.svg;
      cx += c2.w + GAP;
    } else {
      body += c.svg;
      cx += c.w + GAP;
    }
  }

  y = cy + chipH;

  if (!hide.includes("footer")) {
    y += 10;
    body += `<text x="${PAD}" y="${y}" font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">self-built • actions → svg</text>`;
    y += 10;
  } else {
    y += 8;
  }

  const H = Math.max(120, y + 10); // ✅ không bao giờ bị cắt đáy

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(full)}">
  ${defs}
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14"
        fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>
  ${body}
</svg>`;
}

export async function writePinPair({ owner, repo, outDark, outLight, themeDark, themeLight, show, hide }) {
  const data = await gh(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const showList = listLowerCSV(show);
  const hideList = listLowerCSV(hide);

  const dark = renderPinCard({ owner, repo, themeName: themeDark, data, show: showList, hide: hideList });
  const light = renderPinCard({ owner, repo, themeName: themeLight, data, show: showList, hide: hideList });

  fs.mkdirSync(path.dirname(outDark), { recursive: true });
  fs.writeFileSync(outDark, dark, "utf8");
  fs.writeFileSync(outLight, light, "utf8");
}

// CLI
async function main() {
  const owner = arg("owner", arg("username", "TranDangKhoaTechnology"));
  const repo = arg("repo", null);
  const theme = arg("theme", "tokyonight");
  const outFile = arg("out", null);
  const show = arg("show", "stars,forks,issues,watchers,language,license,topics,updated,size");
  const hide = arg("hide", "");

  if (!repo) throw new Error("Missing --repo");
  if (!outFile) throw new Error("Missing --out");

  const data = await gh(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const svg = renderPinCard({
    owner, repo, themeName: theme, data,
    show: listLowerCSV(show),
    hide: listLowerCSV(hide),
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, svg, "utf8");
  console.log(`Wrote ${outFile}`);
}

if (process.argv[1]?.endsWith("pin-card.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
