#!/usr/bin/env node

/**
 * CLI script to generate a marketing hero/banner SVG card.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Title                 [badge1] [badge2] [badge3]    │
 *   │  Tagline                                              │
 *   │  Description text...                                  │
 *   │                                                       │
 *   │  ┌─ Left column ──────┐  │  ┌─ Right column ──────┐  │
 *   │  │ WHAT I DO          │  │  │ OVERVIEW             │  │
 *   │  │ ▸ point 1          │  │  │  25+     Projects    │  │
 *   │  │ ▸ point 2          │  │  │  <24h    Response    │  │
 *   │  │ ▸ point 3          │  │  │  10+     Clients     │  │
 *   │  └────────────────────┘  │  └──────────────────────┘  │
 *   │                                                       │
 *   │  GitHub  Email              [─── Contact me ───]      │
 *   └──────────────────────────────────────────────────────┘
 *
 * Usage:
 *   node scripts/marketing.mjs
 *     --style clean|cleanlight
 *     --out path/to/card.svg
 *     --title "..." --tagline "..." --desc "..."
 *     --badges "tag1,tag2,tag3"
 *     --points "Point 1,Point 2"
 *     --stats "Label|value,Label2|value2"
 *     --cta_text "Contact" --cta_url "mailto:..."
 *     --links "GitHub|https://...,Email|mailto:..."
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// ═══════════════════════════════════════════════════════════
//  THEMES
// ═══════════════════════════════════════════════════════════

const THEMES = {
  clean: {
    bg: "#0d1117",
    border: "#30363d",
    title: "#58a6ff",
    text: "#c9d1d9",
    muted: "#8b949e",
    accent: "#f0883e",
    badge: "#21262d",
    badgeText: "#c9d1d9",
    ctaBg: "#238636",
    ctaText: "#ffffff",
    statsLabel: "#8b949e",
    statsValue: "#f0f6fc",
  },
  cleanlight: {
    bg: "#ffffff",
    border: "#d0d7de",
    title: "#0969da",
    text: "#1f2328",
    muted: "#656d76",
    accent: "#fd8a25",
    badge: "#eaeef2",
    badgeText: "#1f2328",
    ctaBg: "#1f883d",
    ctaText: "#ffffff",
    statsLabel: "#656d76",
    statsValue: "#1f2328",
  },
};

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const COLORS = (c) => `
  .t  { fill:${c.title}; font-size:24px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .tag{ fill:${c.accent}; font-size:15px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .d  { fill:${c.text}; font-size:14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .m  { fill:${c.muted}; font-size:11px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-transform:uppercase; letter-spacing:1px; }
  .b  { fill:${c.badgeText}; font-size:12px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .pt { fill:${c.text}; font-size:14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .sv { fill:${c.statsValue}; font-size:22px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .sl { fill:${c.statsLabel}; font-size:11px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; text-transform:uppercase; letter-spacing:0.8px; }
  .ct { fill:${c.ctaText}; font-size:14px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .lk { fill:${c.title}; font-size:13px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  a{text-decoration:none}
`;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const key = args[i].slice(2);
    const val = args[i + 1];
    if (val !== undefined && !val.startsWith("--")) {
      opts[key] = val;
      i++;
    } else {
      opts[key] = "true";
    }
  }
  return opts;
};

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

const W = 800;
const P = 40;       // horizontal padding
const COL_L = P;     // left column X
const COL_R = 380;   // right column X
const BADGE_GAP = 8;
const BADGE_H = 26;

// ═══════════════════════════════════════════════════════════
//  RUN
// ═══════════════════════════════════════════════════════════

const run = async () => {
  const opts = parseArgs();
  if (!opts.out) {
    console.error("Error: --out is required.");
    process.exit(1);
  }

  const style = opts.style || "clean";
  const c = THEMES[style] || THEMES.clean;

  // Parse inputs
  const title = esc(opts.title || "Your Name");
  const tagline = esc(opts.tagline || "");
  const desc = esc(opts.desc || "");
  const badges = (opts.baddes || opts.badges || "").split(",").filter(Boolean);
  const points = (opts.points || "").split(",").filter(Boolean);
  const statsRaw = (opts.stats || "").split(",").filter(Boolean);
  const ctaText = esc(opts.cta_text || "Contact me");
  const ctaUrl = esc(opts.cta_url || "#");
  const links = (opts.links || "").split(",").filter(Boolean);

  // Compute badge widths
  const badgeData = badges.map((b) => ({
    text: esc(b.trim()),
    w: b.trim().length * 8 + 28,
  }));

  // ═══ Layout computation (top-down Y) ═══════════════════

  let y = 0;
  let svg = "";

  // --- Header: title + tagline ---
  const titleY = 40;
  const taglineY = titleY + (tagline ? 24 : 0);
  const headerEnd = tagline ? taglineY + 10 : titleY + 20;

  // --- Description ---
  const descEnd = desc ? headerEnd + 30 : headerEnd;

  // --- Badges (right-aligned, inline with header) ---
  const badgeTotalW = badgeData.reduce((s, b) => s + b.w, 0) + (badgeData.length - 1) * BADGE_GAP;
  const badgeX0 = W - P - badgeTotalW;

  // --- Two-column body ---
  const bodyTop = descEnd + 20;

  // Points column
  const pointItems = points.map((p) => esc(p.trim()));
  const pointsH = pointItems.length > 0 ? 20 + pointItems.length * 26 : 0;

  // Stats column
  const statsItems = statsRaw.map((s) => {
    const [label, value] = s.split("|");
    return { label: esc(label?.trim() || ""), value: esc(value?.trim() || "") };
  });
  const statsH = statsItems.length > 0 ? 20 + statsItems.length * 52 : 0;

  const colH = Math.max(pointsH, statsH, 10);

  // --- Footer: links + CTA ---
  const FOOTER_H = 60;
  const bodyEnd = bodyTop + colH;

  // --- Total height ---
  const H = bodyEnd + FOOTER_H + 10;

  // ═══ Render SVG ════════════════════════════════════════

  svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">\n`;
  svg += `<defs><style>${COLORS(c)}</style></defs>\n`;

  // Background
  svg += `<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="${c.bg}" stroke="${c.border}" stroke-width="1" />\n`;

  // Title + tagline (left)
  svg += `<text x="${P}" y="${titleY}" class="t">${title}</text>\n`;
  if (tagline) svg += `<text x="${P}" y="${taglineY}" class="tag">${tagline}</text>\n`;

  // Badges (right-aligned, top)
  let bx = badgeX0;
  for (const b of badgeData) {
    svg += `<rect x="${bx}" y="${titleY - 16}" width="${b.w}" height="${BADGE_H}" rx="13" fill="${c.badge}" />\n`;
    svg += `<text x="${bx + b.w / 2}" y="${titleY - 16 + BADGE_H / 2 + 1}" class="b" text-anchor="middle" dominant-baseline="central">${b.text}</text>\n`;
    bx += b.w + BADGE_GAP;
  }

  // Description
  if (desc) {
    svg += `<text x="${P}" y="${descEnd - 8}" class="d">${desc}</text>\n`;
  }

  // Columns header
  if (pointItems.length > 0) {
    svg += `<text x="${P}" y="${bodyTop}" class="m">What I Do</text>\n`;
    let py = bodyTop + 22;
    for (const pt of pointItems) {
      svg += `<text x="${P + 4}" y="${py}" class="pt">▸ ${pt}</text>\n`;
      py += 26;
    }
  }

  if (statsItems.length > 0) {
    svg += `<text x="${COL_R}" y="${bodyTop}" class="m">Overview</text>\n`;
    let sy = bodyTop + 28;
    for (const s of statsItems) {
      svg += `<text x="${COL_R}" y="${sy}" class="sv">${s.value}</text>\n`;
      svg += `<text x="${COL_R}" y="${sy + 20}" class="sl">${s.label}</text>\n`;
      sy += 52;
    }
  }

  // Footer: CTA right, links left
  const ctaW = Math.max(120, ctaText.length * 9 + 40);
  const ctaX = W - P - ctaW;
  const fy = H - 50;

  svg += `<a href="${ctaUrl}">\n`;
  svg += `  <rect x="${ctaX}" y="${fy - 18}" width="${ctaW}" height="36" rx="8" fill="${c.ctaBg}" />\n`;
  svg += `  <text x="${ctaX + ctaW / 2}" y="${fy + 1}" class="ct" text-anchor="middle" dominant-baseline="central">${ctaText}</text>\n`;
  svg += `</a>\n`;

  let lx = P;
  for (const link of links) {
    const parts = link.split("|");
    if (parts.length === 2) {
      const lt = esc(parts[0].trim());
      const lu = esc(parts[1].trim());
      svg += `<a href="${lu}"><text x="${lx}" y="${fy}" class="lk">${lt}</text></a>\n`;
      lx += lt.length * 9 + 28;
    }
  }

  svg += `</svg>`;

  const outPath = resolve(opts.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, svg, "utf8");
  console.log(`Wrote ${outPath}`);
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
