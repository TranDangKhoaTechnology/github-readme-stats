// scripts/marketing.mjs
// Node 20+
// Generate a marketing/hero SVG banner for your README.
//
// Example:
// node scripts/marketing.mjs \
//   --theme tokyonight \
//   --title "Trần Đăng Khoa" \
//   --tagline "Automation • Web Apps • AI" \
//   --desc "Tôi xây hệ thống tự động hoá, landing page và chatbot để giúp bạn tăng doanh thu." \
//   --badges "Open for freelance,Remote,Fast delivery" \
//   --points "Tự động hoá quy trình (Sheets/CRM/Zapier),Landing page SEO + Analytics,Chatbot + API tích hợp" \
//   --stats "Projects|25+,Response|<24h,Clients|10+" \
//   --cta_text "Contact me" \
//   --cta_url "mailto:trandangkhoa.automation@gmail.com" \
//   --links "Website|https://example.com,GitHub|https://github.com/TranDangKhoaTechnology" \
//   --out generated/hero.dark.svg

import fs from "node:fs";
import path from "node:path";
import { resolveTheme, esc, wrapLines, estTextW } from "./theme.mjs";

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
function listCSV(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function listPairs(v) {
  // "Label|Value,Label|Value"
  return listCSV(v).map((x) => {
    const [a, b] = x.split("|").map((s) => (s ?? "").trim());
    return { a, b };
  }).filter(p => p.a && p.b);
}

function clampToWidth(text, maxW, fontSize) {
  let s = String(text || "");
  if (estTextW(s, fontSize) <= maxW) return s;
  while (s.length > 4 && estTextW(s + "…", fontSize) > maxW) s = s.slice(0, -1);
  return s.replace(/\s+$/, "") + "…";
}

function chip({ x, y, text, t }) {
  const fs = 11;
  const padX = 10;
  const h = 22;
  const w = Math.ceil(padX * 2 + estTextW(text, fs));
  return {
    w,
    svg: `
      <g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11"
              fill="${t.chipBg}" stroke="rgba(255,255,255,0.06)"/>
        <text x="${x + padX}" y="${y + 15}" font-size="${fs}"
              fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>
      </g>`,
  };
}

function iconCircle({ x, y, r = 18, t, text = "★" }) {
  return `
    <g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,0.07)" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="${r}"
            fill="${t.accent}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>
    </g>`;
}

function linkWrap(url, inner) {
  if (!url) return inner;
  const safe = esc(url);
  return `<a xlink:href="${safe}" href="${safe}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
}

function button({ x, y, w, h, t, label, url }) {
  const fs = 12;
  const txtW = estTextW(label, fs);
  const tx = x + Math.max(14, (w - txtW) / 2);
  const inner = `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.floor(h / 2)}"
            fill="url(#ctaGrad)" stroke="rgba(255,255,255,0.14)"/>
      <text x="${tx}" y="${y + Math.floor(h * 0.68)}" font-size="${fs}" font-weight="800"
            fill="${t.bg}" font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
    </g>`;
  return linkWrap(url, inner);
}

function featureRow({ x, y, t, text }) {
  const fs = 12;
  const icon = `
    <g transform="translate(${x},${y})">
      <circle cx="6" cy="6" r="6" fill="${t.accent}" opacity="0.95"/>
      <text x="6" y="10" text-anchor="middle" font-size="10" font-weight="900"
            fill="${t.bg}" font-family="Segoe UI, Ubuntu, Arial">✓</text>
    </g>`;
  const label = `<text x="${x + 18}" y="${y + 11}" font-size="${fs}"
                  fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>`;
  return icon + label;
}

function statPill({ x, y, w, h, t, k, v }) {
  const inner = `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
            fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.06)"/>
      <text x="${x + 12}" y="${y + 16}" font-size="11" fill="${t.muted}"
            font-family="Segoe UI, Ubuntu, Arial">${esc(k)}</text>
      <text x="${x + 12}" y="${y + 34}" font-size="16" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(v)}</text>
    </g>`;
  return inner;
}

function renderHero(opts) {
  const t = resolveTheme(opts.theme);

  // Outer padding to keep shadow inside the exported SVG
  const CANVAS_W = opts.width;
  const OUT = 18;
  const W = CANVAS_W - OUT * 2;

  const PAD = 26;
  const INNER_X = OUT;
  const INNER_Y = OUT;

  const leftW = Math.floor(W * 0.62);
  const rightW = W - leftW - PAD;

  const title = opts.title;
  const tagline = opts.tagline;
  const descLines = wrapLines(opts.desc, 68, 2);

  const badges = opts.badges.slice(0, 6);
  const points = opts.points.slice(0, 3);
  const stats = opts.stats.slice(0, 3);
  const links = opts.links.slice(0, 3);

  let y = 22;

  // Right side height estimate (cards)
  const rightCardTop = 54;
  const statH = 48;
  const statGap = 10;
  const rightMinH = rightCardTop + stats.length * (statH + statGap) + 52;

  // Left side height estimate
  const leftMinH = 210;

  const H_INNER = Math.max(leftMinH, rightMinH);
  const CANVAS_H = H_INNER + OUT * 2;

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

    <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1 || t.title}" />
      <stop offset="100%" stop-color="${t.grad2 || t.accent}" />
    </linearGradient>

    <filter id="shadow" x="-10%" y="-10%" width="120%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${t.shadow || "rgba(0,0,0,0.35)"}"/>
    </filter>

    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.25 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;

  // Background blob
  const blob = `
    <g filter="url(#softGlow)" opacity="0.9">
      <circle cx="${INNER_X + W - 60}" cy="${INNER_Y + 46}" r="40" fill="${t.grad2 || t.accent}" opacity="0.30"/>
      <circle cx="${INNER_X + W - 120}" cy="${INNER_Y + 92}" r="62" fill="${t.grad1 || t.title}" opacity="0.18"/>
    </g>`;

  // Header (left)
  const monogram = (title || "DK")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase?.() || "")
    .join("") || "DK";

  const header = `
    <g transform="translate(${INNER_X + PAD},${INNER_Y + y})">
      <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,0.07)"/>
      <text x="18" y="24" text-anchor="middle" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(monogram)}</text>

      <text x="48" y="18" font-size="22" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(clampToWidth(title, leftW - 70, 22))}</text>
      <text x="48" y="40" font-size="12"
            fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(tagline)}</text>
    </g>`;

  y += 66;

  // Description
  let descSvg = "";
  for (let i = 0; i < descLines.length; i++) {
    descSvg += `<text x="${INNER_X + PAD}" y="${INNER_Y + y + i * 18}"
                    font-size="13" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(descLines[i])}</text>`;
  }
  y += descLines.length * 18 + 16;

  // Badges row
  let badgesSvg = "";
  if (badges.length) {
    let bx = INNER_X + PAD;
    const by = INNER_Y + y;
    for (const b of badges) {
      const c = chip({ x: bx, y: by, text: b, t });
      if (bx + c.w > INNER_X + PAD + leftW - 10) break;
      badgesSvg += c.svg;
      bx += c.w + 8;
    }
    y += 30;
  }

  // Divider
  const divider = `<rect x="${INNER_X + PAD}" y="${INNER_Y + y}" width="${leftW}" height="1" fill="${t.track}" opacity="0.95"/>`;
  y += 16;

  // Feature bullets
  let pointsSvg = "";
  let py = INNER_Y + y;
  for (const p of points) {
    pointsSvg += featureRow({ x: INNER_X + PAD, y: py, t, text: p });
    py += 22;
  }
  y += points.length * 22 + 12;

  // CTA + links
  const ctaX = INNER_X + PAD;
  const ctaY = INNER_Y + y;
  const cta = button({
    x: ctaX,
    y: ctaY,
    w: 150,
    h: 34,
    t,
    label: opts.ctaText,
    url: opts.ctaUrl,
  });

  let linksSvg = "";
  if (links.length) {
    let lx = ctaX + 160;
    const ly = ctaY + 6;
    for (const { a, b } of links) {
      const label = `@${a}`;
      const w = Math.ceil(18 + estTextW(label, 11) + 18);
      const inner = `
        <g>
          <rect x="${lx}" y="${ly}" width="${w}" height="22" rx="11"
                fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.06)"/>
          <text x="${lx + 12}" y="${ly + 15}" font-size="11" fill="${t.muted}"
                font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
        </g>`;
      linksSvg += linkWrap(b, inner);
      lx += w + 8;
      if (lx > INNER_X + PAD + leftW - 60) break;
    }
  }

  // Right column: header + stats cards
  const rx = INNER_X + PAD + leftW + PAD;
  const rightHeader = `
    <g transform="translate(${rx},${INNER_Y + 24})">
      ${iconCircle({ x: 18, y: 18, r: 18, t, text: "⚡" })}
      <text x="46" y="18" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">Quick facts</text>
      <text x="46" y="38" font-size="11"
            fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(opts.rightNote)}</text>
    </g>`;

  let statsSvg = "";
  let sy = INNER_Y + rightCardTop;
  const statW = rightW;
  for (const { a, b } of stats) {
    statsSvg += statPill({ x: rx, y: sy, w: statW, h: statH, t, k: a, v: b });
    sy += statH + statGap;
  }

  const footer = `<text x="${INNER_X + PAD}" y="${INNER_Y + H_INNER - 16}"
                   font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">self-built • actions → svg</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     role="img" aria-label="${esc(title)}">
  ${defs}
  ${blob}
  <g transform="translate(${OUT},${OUT})">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H_INNER - 1}" rx="16"
          fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>
    ${header}
    ${descSvg}
    ${badgesSvg}
    ${divider}
    ${pointsSvg}
    ${cta}
    ${linksSvg}
    ${rightHeader}
    ${statsSvg}
    ${footer}
  </g>
</svg>`;
}

async function main() {
  const theme = arg("theme", "tokyonight");
  const width = argInt("width", 1030);
  const outFile = arg("out", "generated/hero.svg");

  const title = arg("title", "Your Name");
  const tagline = arg("tagline", "Automation • Web Apps • AI");
  const desc = arg("desc", "Mô tả ngắn về bạn/dịch vụ của bạn (tối đa 2 dòng).");
  const badges = listCSV(arg("badges", "Open for freelance,Remote,Fast delivery"));
  const points = listCSV(arg("points", "Automation workflow,Landing page SEO + Analytics,Chatbot + API"));
  const stats = listPairs(arg("stats", "Projects|25+,Response|<24h,Clients|10+"));
  const ctaText = arg("cta_text", "Contact me");
  const ctaUrl = arg("cta_url", "");
  const links = listPairs(arg("links", "")); // "Website|https://...,LinkedIn|https://..."
  const rightNote = arg("right_note", "Let’s build something");

  try {
    const svg = renderHero({
      theme,
      width,
      title,
      tagline,
      desc,
      badges,
      points,
      stats,
      ctaText,
      ctaUrl,
      links,
      rightNote,
    });

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg, "utf8");
    console.log(`Wrote ${outFile}`);
  } catch (e) {
    const msg = String(e?.message || e);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1030" height="140" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#111"/>
  <text x="16" y="34" fill="#7aa2f7" font-size="18" font-family="Segoe UI, Ubuntu, Arial" font-weight="900">Hero Banner</text>
  <text x="16" y="70" fill="#c0caf5" font-size="12" font-family="Segoe UI, Ubuntu, Arial">Build failed</text>
  <text x="16" y="96" fill="#c0caf5" font-size="10" font-family="Segoe UI, Ubuntu, Arial">${esc(msg).slice(0, 180)}</text>
</svg>`;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fallback, "utf8");
    process.exitCode = 0;
  }
}

main();
