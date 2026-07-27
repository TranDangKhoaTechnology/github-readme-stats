#!/usr/bin/env node

/**
 * CLI script to generate a marketing hero/banner SVG card.
 *
 * Usage:
 *   node scripts/marketing.mjs
 *     --style clean|cleanlight
 *     --out generated/hero.dark.svg
 *     --title "Trần Đăng Khoa"
 *     --tagline "Automation • Web Apps • AI"
 *     --desc "I build automation systems..."
 *     --badges "Open for freelance,Remote,Fast delivery"
 *     --points "Point 1,Point 2,Point 3"
 *     --stats "Projects|25+,Response|<24h,Clients|10+"
 *     --cta_text "Contact me"
 *     --cta_url "mailto:..."
 *     --links "GitHub|https://github.com/...,Email|mailto:..."
 *     --avatar "https://github.com/username.png"
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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

const THEMES = {
  clean: {
    bg: "#0d1117",
    cardBg: "#161b22",
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
    cardBg: "#f6f8fa",
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

const escapeXml = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderHero = (opts) => {
  const style = opts.style || "clean";
  const colors = THEMES[style] || THEMES.clean;

  const title = escapeXml(opts.title || "Your Name");
  const tagline = escapeXml(opts.tagline || "");
  const desc = escapeXml(opts.desc || "");
  const badges = (opts.badges || "").split(",").filter(Boolean);
  const points = (opts.points || "").split(",").filter(Boolean);
  const stats = (opts.stats || "").split(",").filter(Boolean);
  const ctaText = escapeXml(opts.cta_text || "Contact me");
  const ctaUrl = escapeXml(opts.cta_url || "#");
  const links = (opts.links || "").split(",").filter(Boolean);

  const width = 800;
  const padX = 40;
  let y = 50;
  const lineGap = 32;

  const badgeHeight = 28;
  const badgeGap = 8;
  const itemGap = 12;

  const cardHeight = 100 + Math.max(
    points.length * (lineGap + 4) + 40,
    stats.length * 60 + 60,
  );

  let svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  viewBox="0 0 ${width} ${cardHeight}"
  fill="none"
>
  <defs>
    <style>
      .title { fill: ${colors.title}; font-size: 28px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .tagline { fill: ${colors.accent}; font-size: 16px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .desc { fill: ${colors.text}; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .muted { fill: ${colors.muted}; font-size: 13px; font-family: monospace; }
      .badge-text { fill: ${colors.badgeText}; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 500; }
      .point-text { fill: ${colors.text}; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .stats-label { fill: ${colors.statsLabel}; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; }
      .stats-value { fill: ${colors.statsValue}; font-size: 22px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .link-text { fill: ${colors.title}; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .cta-text { fill: ${colors.ctaText}; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      a { text-decoration: none; }
    </style>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${cardHeight}" rx="10" fill="${colors.bg}" />
  <rect x="0" y="0" width="${width}" height="${cardHeight}" rx="10" stroke="${colors.border}" stroke-width="1" fill="none" />
`;

  // ===== HEADER =====
  if (opts.avatar) {
    svg += `  <image href="${escapeXml(opts.avatar)}" x="${padX}" y="${y - 10}" width="48" height="48" rx="24" />\n`;
    const nameX = padX + 60;
    svg += `  <text x="${nameX}" y="${y + 16}" class="title">${title}</text>\n`;
    if (tagline) {
      svg += `  <text x="${nameX}" y="${y + 38}" class="tagline">${tagline}</text>\n`;
    }
  } else {
    svg += `  <text x="${padX}" y="${y + 16}" class="title">${title}</text>\n`;
    if (tagline) {
      y += 6;
      svg += `  <text x="${padX}" y="${y + 38}" class="tagline">${tagline}</text>\n`;
    }
  }

  y += 70;

  // ===== DESCRIPTION =====
  if (desc) {
    svg += `  <text x="${padX}" y="${y}" class="desc">${desc}</text>\n`;
    y += 24;
  }

  // ===== BADGES =====
  if (badges.length > 0) {
    let bx = padX;
    for (const badge of badges) {
      const text = escapeXml(badge.trim());
      const tw = text.length * 8 + 24;
      svg += `  <rect x="${bx}" y="${y - 18}" width="${tw}" height="${badgeHeight}" rx="14" fill="${colors.badge}" />\n`;
      svg += `  <text x="${bx + 12}" y="${y + 4}" class="badge-text">${text}</text>\n`;
      bx += tw + badgeGap;
    }
    y += 40;
  }

  // ===== TWO COLUMNS: points | stats =====
  const colMid = width / 2;

  // Left column: points
  if (points.length > 0) {
    svg += `  <text x="${padX}" y="${y}" class="muted" font-weight="600">What I do</text>\n`;
    y += 24;
    for (const pt of points) {
      svg += `  <text x="${padX + 8}" y="${y}" class="point-text">▸ ${escapeXml(pt.trim())}</text>\n`;
      y += 24;
    }
  }

  // Right column: stats
  y = y - points.length * 24 - 24 + 40; // reset
  if (stats.length > 0) {
    let sx = colMid + 20;
    svg += `  <text x="${sx}" y="${y - 18}" class="muted" font-weight="600">Overview</text>\n`;
    for (const st of stats) {
      const parts = st.split("|");
      if (parts.length === 2) {
        svg += `  <text x="${sx}" y="${y + 8}" class="stats-value">${escapeXml(parts[1].trim())}</text>\n`;
        svg += `  <text x="${sx}" y="${y + 28}" class="stats-label">${escapeXml(parts[0].trim())}</text>\n`;
        y += 50;
      }
    }
  }

  // ===== CTA BUTTON =====
  const ctaY = cardHeight - 70;
  const ctaW = 160;
  const ctaH = 36;
  const ctaX = width - padX - ctaW;

  svg += `  <a href="${ctaUrl}">\n`;
  svg += `    <rect x="${ctaX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="8" fill="${colors.ctaBg}" />\n`;
  svg += `    <text x="${ctaX + ctaW / 2}" y="${ctaY + ctaH / 2 + 1}" class="cta-text" text-anchor="middle" dominant-baseline="central">${ctaText}</text>\n`;
  svg += `  </a>\n`;

  // ===== LINKS =====
  if (links.length > 0) {
    let lx = padX;
    for (const link of links) {
      const parts = link.split("|");
      if (parts.length === 2) {
        const linkText = escapeXml(parts[0].trim());
        const linkUrl = escapeXml(parts[1].trim());
        svg += `  <a href="${linkUrl}">\n`;
        svg += `    <text x="${lx}" y="${ctaY + 22}" class="link-text">${linkText}</text>\n`;
        svg += `  </a>\n`;
        lx += linkText.length * 9 + 24;
      }
    }
  }

  svg += `</svg>`;
  return svg;
};

const run = async () => {
  const opts = parseArgs();

  if (!opts.out) {
    console.error("Error: --out is required.");
    process.exit(1);
  }

  const svg = renderHero(opts);
  const outPath = resolve(opts.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, svg, "utf8");
  console.log(`Wrote ${outPath}`);
};

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
