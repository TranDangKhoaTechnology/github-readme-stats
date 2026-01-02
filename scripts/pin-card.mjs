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
  langColor, listLowerCSV, resolveTheme
} from "./theme.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
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

// clamp text to fit width (rough, good enough)
function clampToWidth(text, maxW, fontSize) {
  let s = String(text || "");
  if (estTextW(s, fontSize) <= maxW) return s;
  while (s.length > 4 && estTextW(s + "…", fontSize) > maxW) {
    s = s.slice(0, -1);
  }
  return s.replace(/\s+$/, "") + "…";
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

function renderPinCard({ owner, repo, themeName, data, show, hide }) {
  const t = resolveTheme(themeName);

  // ======== IMPORTANT FIX: SAFE OUTER PADDING =========
  // Giữ canvas 495 để layout README ổn, nhưng vẽ card vào "inner box"
  // để shadow KHÔNG tràn ra ngoài ảnh => đặt 2 ảnh cạnh nhau không bị chồng.
  const CANVAS_W = 495;
  const OUT = 14;                 // lề trong suốt
  const W = CANVAS_W - OUT * 2;   // inner width dùng để layout
  const PAD = 16;
  const GAP = 8;

  const descLines = hide.includes("desc") ? [] : wrapLines(data.description || "", 62, 2);
  const topics = (Array.isArray(data.topics) ? data.topics : []).slice(0, 3);

  const lang = data.language || "—";
  const langDot = langColor(lang);

  const showTopics = show.includes("topics") && !hide.includes("topics") && topics.length;
  const pieces = [];

  if (show.includes("stars")) pieces.push(`★ ${fmtCompact(data.stargazers_count)}`);
  if (show.includes("forks")) pieces.push(`⑂ ${fmtCompact(data.forks_count)}`);
  if (show.includes("issues")) pieces.push(`! ${fmtCompact(data.open_issues_count)}`);
  if (show.includes("watchers")) pieces.push(`👁 ${fmtCompact(data.subscribers_count ?? data.watchers_count ?? 0)}`);
  if (show.includes("language")) pieces.push(`Lang ${lang}`);
  if (show.includes("license")) pieces.push(`Lic ${(data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION") ? data.license.spdx_id : "—"}`);
  if (show.includes("size")) pieces.push(`Size ${fmtCompact(data.size ?? 0)}KB`);
  if (show.includes("updated")) pieces.push(`↻ ${toDateShort(data.pushed_at || data.updated_at)}`);

  // Right badge nhỏ gọn để không đụng title
  const badge = `${data.private ? "Private" : "Public"}${data.fork ? " • Fork" : ""}`;

  // Title font & clamp theo width trống
  let titleSize = 16;
  if (repo.length > 26) titleSize = 14;
  if (repo.length > 36) titleSize = 13;

  const rightBadgeW = estTextW(badge, 11);
  const maxTitleW = (W - PAD * 2) - rightBadgeW - 18; // chừa khoảng trống
  const titleText = clampToWidth(repo, maxTitleW, titleSize);

  // ===== layout Y (inner) =====
  let y = 16;
  const headerH = hide.includes("owner") ? 28 : 42;
  const descH = descLines.length ? (descLines.length * 16 + 6) : 0;
  const topicsH = showTopics ? 26 : 0;

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

    <!-- shadow nhỏ hơn + nằm trong OUT padding -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="${t.shadow || "rgba(0,0,0,0.35)"}"/>
    </filter>
  </defs>`;

  let body = `
  <g transform="translate(${PAD},${y})">
    <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.07)"/>
    <text x="10" y="14" text-anchor="middle" font-size="12" fill="${t.accent}" font-family="Segoe UI, Ubuntu, Arial">⌁</text>

    <text x="30" y="14" font-size="${titleSize}" font-weight="900" fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(titleText)}</text>
    ${hide.includes("owner") ? "" : `<text x="30" y="32" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(owner)}</text>`}

    <text x="${W - PAD * 2}" y="14" text-anchor="end" font-size="11" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(badge)}</text>
  </g>`;

  y += headerH;

  if (descLines.length) {
    const baseY = y;
    for (let i = 0; i < descLines.length; i++) {
      body += `<text x="${PAD}" y="${baseY + 14 + i * 16}" font-size="12" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(descLines[i])}</text>`;
    }
    y += descH;
  }

  if (showTopics) {
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

  body += `<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="1" fill="${t.track}" opacity="0.9"/>`;
  y += 12;

  // stats chips wrap (max 2 rows)
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

  const H_INNER = Math.max(120, y + 10);
  const CANVAS_H = H_INNER + OUT * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(owner + "/" + repo)}">
  ${defs}
  <g transform="translate(${OUT},${OUT})">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H_INNER - 1}" rx="14"
          fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>
    ${body}
  </g>
</svg>`;
}

async function main() {
  const owner = arg("owner", arg("username", "TranDangKhoaTechnology"));
  const repo = arg("repo", null);
  const theme = arg("theme", "tokyonight");
  const outFile = arg("out", null);
  const show = listLowerCSV(arg("show", "stars,forks,issues,watchers,language,license,topics,updated,size"));
  const hide = listLowerCSV(arg("hide", ""));

  if (!repo) throw new Error("Missing --repo");
  if (!outFile) throw new Error("Missing --out");

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const data = await gh(url);

    const svg = renderPinCard({ owner, repo, themeName: theme, data, show, hide });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="495" height="140" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111"/>
  <text x="16" y="32" fill="#7aa2f7" font-size="16" font-family="Segoe UI, Ubuntu, Arial" font-weight="800">Pin Card</text>
  <text x="16" y="60" fill="#c0caf5" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="84" fill="#c0caf5" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 160)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
