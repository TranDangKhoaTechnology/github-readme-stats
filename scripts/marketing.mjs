// scripts/marketing.mjs
// Generate a marketing/hero SVG banner for README.
//
// style: clean | cleanlight | default
//
// Example:
// node scripts/marketing.mjs --style clean --out generated/hero.dark.svg \
//   --title "Trần Đăng Khoa" \
//   --tagline "Automation • Web Apps • AI" \
//   --desc "Tôi xây hệ thống tự động hoá, landing page và chatbot để giúp bạn tăng doanh thu." \
//   --badges "Open for freelance,Remote,Fast delivery" \
//   --points "Tự động hoá quy trình (Sheets/CRM/Zapier),Landing page SEO + Analytics,Chatbot + API tích hợp" \
//   --stats "Projects|25+,Response|<24h,Clients|10+" \
//   --cta_text "Contact me" \
//   --cta_url "mailto:trandangkhoa.automation@gmail.com" \
//   --links "GitHub|https://github.com/TranDangKhoaTechnology,Email|mailto:trandangkhoa.automation@gmail.com"

import fs from "node:fs";
import path from "node:path";
import { resolveTheme, esc, estTextW } from "./theme.mjs";

// -------------------- CLI helpers --------------------
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
  return listCSV(v)
    .map((x) => {
      const [a, b] = x.split("|").map((s) => (s ?? "").trim());
      return { a, b };
    })
    .filter((p) => p.a && p.b);
}

function clampToWidth(text, maxW, fontSize) {
  let s = String(text || "");
  if (estTextW(s, fontSize) <= maxW) return s;
  while (s.length > 4 && estTextW(s + "…", fontSize) > maxW) s = s.slice(0, -1);
  return s.replace(/\s+$/, "") + "…";
}

// Wrap by pixel width + small balancing to avoid a super-short last line
function wrapPx(text, maxW, fontSize, maxLines = 2) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = "";

  const pushLine = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
  };

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (estTextW(candidate, fontSize) <= maxW) {
      line = candidate;
      continue;
    }

    if (!line) {
      // single too-long word
      lines.push(clampToWidth(w, maxW, fontSize));
    } else {
      pushLine();
      line = w;
    }

    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && line.trim()) pushLine();

  // trim to maxLines
  if (lines.length > maxLines) lines.length = maxLines;

  // balance: if 2 lines and last line is too short, move a word from line1 -> line2
  if (lines.length === 2) {
    const w2 = estTextW(lines[1], fontSize);
    const tooShort = w2 < maxW * 0.28;
    if (tooShort) {
      const w1Parts = lines[0].split(/\s+/);
      const w2Parts = lines[1].split(/\s+/);
      while (w1Parts.length > 3) {
        const moved = w1Parts.pop();
        if (!moved) break;
        w2Parts.unshift(moved);
        const new1 = w1Parts.join(" ");
        const new2 = w2Parts.join(" ");
        if (estTextW(new1, fontSize) <= maxW && estTextW(new2, fontSize) <= maxW) {
          lines[0] = new1;
          lines[1] = new2;
          if (estTextW(lines[1], fontSize) >= maxW * 0.34) break;
        } else {
          // revert move if it breaks width
          w1Parts.push(moved);
          w2Parts.shift();
          break;
        }
      }
    }
  }

  // if content likely truncated, ellipsis last line
  // (simple heuristic: original words more than joined lines words)
  const joined = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (joined < words.length && lines.length) {
    lines[lines.length - 1] = clampToWidth(lines[lines.length - 1], maxW, fontSize);
  }

  return lines;
}

// -------------------- Components --------------------
function linkWrap(url, inner) {
  if (!url) return inner;
  const safe = esc(url);
  return `<a xlink:href="${safe}" href="${safe}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
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
              fill="${t.chipBg}" stroke="${t.pillStroke}"/>
        <text x="${x + padX}" y="${y + 15}" font-size="${fs}"
              fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>
      </g>`,
  };
}

function button({ x, y, w, h, t, label, url }) {
  const fs = 12;
  const txtW = estTextW(label, fs);
  const tx = x + Math.max(14, (w - txtW) / 2);
  const inner = `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.floor(h / 2)}"
            fill="url(#ctaGrad)" stroke="${t.border}"/>
      <text x="${tx}" y="${y + Math.floor(h * 0.68)}" font-size="${fs}" font-weight="900"
            fill="${t.buttonText}" font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
    </g>`;
  return linkWrap(url, inner);
}

function featureRow({ x, y, t, textLines }) {
  const fs = 12;
  const lineH = 16;

  const icon = `
    <g transform="translate(${x},${y})">
      <circle cx="6" cy="6" r="6" fill="${t.accent}" opacity="0.95"/>
      <text x="6" y="10" text-anchor="middle" font-size="10" font-weight="900"
            fill="${t.okText}" font-family="Segoe UI, Ubuntu, Arial">✓</text>
    </g>`;

  let svg = icon;
  for (let i = 0; i < textLines.length; i++) {
    svg += `<text x="${x + 18}" y="${y + 11 + i * lineH}" font-size="${fs}"
              fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(textLines[i])}</text>`;
  }
  return { svg, height: Math.max(14, textLines.length * lineH) };
}

function statPill({ x, y, w, h, t, k, v }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"
            fill="${t.pillBg}" stroke="${t.pillStroke}"/>
      <text x="${x + 12}" y="${y + 16}" font-size="11" fill="${t.muted}"
            font-family="Segoe UI, Ubuntu, Arial">${esc(k)}</text>
      <text x="${x + 12}" y="${y + 34}" font-size="16" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(v)}</text>
    </g>`;
}

// -------------------- Styling --------------------
function applyStyle(t, style) {
  if (style === "clean") {
    return {
      ...t,
      bg: "#0b1220",
      bg2: "#070b16",
      title: "#e6edf3",
      text: "rgba(230,237,243,0.92)",
      muted: "rgba(230,237,243,0.70)",
      border: "rgba(56,189,248,0.22)",
      track: "rgba(255,255,255,0.10)",
      chipBg: "rgba(255,255,255,0.06)",
      accent: "#38bdf8",
      grad1: "#38bdf8",
      grad2: "#a78bfa",
      shadow: "rgba(0,0,0,0.38)",
      pillBg: "rgba(255,255,255,0.05)",
      pillStroke: "rgba(255,255,255,0.06)",
      buttonText: "#06101c",
      okText: "#06101c",
    };
  }

  if (style === "cleanlight") {
    return {
      ...t,
      bg: "#f8fafc",
      bg2: "#eef2ff",
      title: "#0f172a",
      text: "rgba(15,23,42,0.92)",
      muted: "rgba(15,23,42,0.68)",
      border: "rgba(37,99,235,0.20)",
      track: "rgba(15,23,42,0.10)",
      chipBg: "rgba(15,23,42,0.06)",
      accent: "#2563eb",
      grad1: "#2563eb",
      grad2: "#7c3aed",
      shadow: "rgba(2,6,23,0.18)",
      pillBg: "rgba(15,23,42,0.04)",
      pillStroke: "rgba(15,23,42,0.06)",
      buttonText: "#ffffff",
      okText: "#ffffff",
    };
  }

  return {
    ...t,
    bg2: t.bg2 || t.bg,
    pillBg: t.pillBg || "rgba(255,255,255,0.06)",
    pillStroke: t.pillStroke || "rgba(255,255,255,0.06)",
    border: t.border || "rgba(255,255,255,0.14)",
    track: t.track || "rgba(255,255,255,0.10)",
    chipBg: t.chipBg || "rgba(255,255,255,0.06)",
    grad1: t.grad1 || t.title,
    grad2: t.grad2 || t.accent,
    shadow: t.shadow || "rgba(0,0,0,0.35)",
    buttonText: t.buttonText || t.bg,
    okText: t.okText || t.bg,
  };
}

// -------------------- Render --------------------
function renderHero(opts) {
  let t = resolveTheme(opts.theme);
  t = applyStyle(t, opts.style);

  const CANVAS_W = opts.width;
  const OUT = 18;
  const W = CANVAS_W - OUT * 2;

  const PAD = 26;  // padding inside card
  const GAP = 26;  // gap between columns
  const R = 16;

  // columns: compute with both side paddings so it never overflows
  const contentW = W - PAD * 2;
  const leftW = Math.floor((contentW - GAP) * 0.62);
  const rightW = (contentW - GAP) - leftW;

  const xL = PAD;
  const rx = PAD + leftW + GAP;

  const title = opts.title || "Your Name";
  const tagline = opts.tagline || "";

  // desc wraps within left column width (pixel-safe)
  const descFs = 13;
  const descLines = wrapPx(opts.desc, leftW, descFs, 2);

  const badges = (opts.badges || []).slice(0, 6);
  const points = (opts.points || []).slice(0, 3);
  const stats = (opts.stats || []).slice(0, 3);
  const links = (opts.links || []).slice(0, 3);

  // left layout
  const headerY = 22;
  const headerH = 66;

  const descY = headerY + headerH;
  const descH = descLines.length * 18;
  const afterDescY = descY + descH + 16;

  const badgesH = badges.length ? 30 : 0;
  const afterBadgesY = afterDescY + badgesH;

  const dividerY = afterBadgesY;
  const afterDividerY = dividerY + 16;

  // bullets
  const bulletFs = 12;
  const bulletGap = 6;

  let bulletsY = afterDividerY;
  let bulletsSvg = "";
  let bulletBlockH = 0;

  for (const p of points) {
    const lines = wrapPx(p, leftW - 22, bulletFs, 2);
    const row = featureRow({ x: xL, y: bulletsY, t, textLines: lines });
    bulletsSvg += row.svg;
    const rowH = row.height;
    bulletsY += rowH + bulletGap;
    bulletBlockH += rowH + bulletGap;
  }
  if (points.length) bulletBlockH = Math.max(0, bulletBlockH - bulletGap);

  const afterBulletsY = afterDividerY + bulletBlockH + 12;

  const CTA_H = 34;
  const ctaY = afterBulletsY;
  const bottomPad = 26;

  // RIGHT layout (FIX: tránh đè chữ)
  const rightHeaderY = 24;
  const rightHeaderH = 46;                // đủ cho 2 dòng text + icon
  const rightCardTop = rightHeaderY + rightHeaderH + 12; // ✅ bắt đầu stats sau header

  const statH = 48;
  const statGap = 10;
  const statsTotalH = stats.length ? stats.length * statH + (stats.length - 1) * statGap : 0;

  // final height: ensure CTA + stats are not clipped
  const leftRequiredH = ctaY + CTA_H + bottomPad;
  const rightRequiredH = rightCardTop + statsTotalH + bottomPad;
  const H_INNER = Math.max(220, leftRequiredH, rightRequiredH);
  const CANVAS_H = H_INNER + OUT * 2;

  const defs = `
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bg}" />
      <stop offset="100%" stop-color="${t.bg2}" />
    </linearGradient>

    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1}" />
      <stop offset="100%" stop-color="${t.grad2}" />
    </linearGradient>

    <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${t.grad1}" />
      <stop offset="100%" stop-color="${t.grad2}" />
    </linearGradient>

    <filter id="shadow" x="-18%" y="-22%" width="140%" height="170%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${t.shadow}"/>
    </filter>

    <clipPath id="cardClip">
      <rect x="0" y="0" width="${W}" height="${H_INNER}" rx="${R}" />
    </clipPath>
  </defs>`;

  const blob = `
    <g opacity="0.55">
      <circle cx="${W - 70}" cy="46" r="40" fill="${t.grad2}" opacity="0.22"/>
      <circle cx="${W - 140}" cy="90" r="64" fill="${t.grad1}" opacity="0.16"/>
      <circle cx="90" cy="${H_INNER - 30}" r="70" fill="${t.grad1}" opacity="0.10"/>
    </g>`;

  const monogram =
    (title || "DK")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase?.() || "")
      .join("") || "DK";

  const header = `
    <g transform="translate(${xL},${headerY})">
      <circle cx="18" cy="18" r="18" fill="${t.pillBg}"/>
      <text x="18" y="24" text-anchor="middle" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(monogram)}</text>

      <text x="48" y="18" font-size="22" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">${esc(
              clampToWidth(title, leftW - 70, 22)
            )}</text>
      <text x="48" y="40" font-size="12"
            fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(tagline)}</text>
    </g>`;

  let descSvg = "";
  for (let i = 0; i < descLines.length; i++) {
    descSvg += `<text x="${xL}" y="${descY + i * 18}"
                    font-size="${descFs}" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(
      descLines[i]
    )}</text>`;
  }

  let badgesSvg = "";
  if (badges.length) {
    let bx = xL;
    const by = afterDescY;
    for (const b of badges) {
      const c = chip({ x: bx, y: by, text: b, t });
      if (bx + c.w > xL + leftW) break;
      badgesSvg += c.svg;
      bx += c.w + 8;
    }
  }

  const divider = `<rect x="${xL}" y="${dividerY}" width="${leftW}" height="1" fill="${t.track}" opacity="0.95"/>`;

  const cta = button({
    x: xL,
    y: ctaY,
    w: 150,
    h: CTA_H,
    t,
    label: opts.ctaText,
    url: opts.ctaUrl,
  });

  let linksSvg = "";
  if (links.length) {
    let lx = xL + 160;
    const ly = ctaY + 6;
    for (const { a, b } of links) {
      const label = `@${a}`;
      const w = Math.ceil(18 + estTextW(label, 11) + 18);
      if (lx + w > xL + leftW) break;

      const inner = `
        <g>
          <rect x="${lx}" y="${ly}" width="${w}" height="22" rx="11"
                fill="${t.pillBg}" stroke="${t.pillStroke}"/>
          <text x="${lx + 12}" y="${ly + 15}" font-size="11" fill="${t.muted}"
                font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
        </g>`;
      linksSvg += linkWrap(b, inner);
      lx += w + 8;
    }
  }

  const rightHeader = `
    <g transform="translate(${rx},${rightHeaderY})">
      <circle cx="18" cy="18" r="18" fill="${t.pillBg}" />
      <text x="18" y="24" text-anchor="middle" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">⚡</text>
      <text x="46" y="18" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">Quick facts</text>
      <text x="46" y="38" font-size="11"
            fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(opts.rightNote)}</text>
    </g>`;

  let statsSvg = "";
  let sy = rightCardTop;
  for (const { a, b } of stats) {
    statsSvg += statPill({ x: rx, y: sy, w: rightW, h: statH, t, k: a, v: b });
    sy += statH + statGap;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     role="img" aria-label="${esc(title)}">
  ${defs}
  <g transform="translate(${OUT},${OUT})">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H_INNER - 1}" rx="${R}"
          fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>
    <g clip-path="url(#cardClip)">
      ${blob}
      ${header}
      ${descSvg}
      ${badgesSvg}
      ${divider}
      ${bulletsSvg}
      ${cta}
      ${linksSvg}
      ${rightHeader}
      ${statsSvg}
    </g>
  </g>
</svg>`;
}

// -------------------- Main --------------------
async function main() {
  const theme = arg("theme", "tokyonight");
  const style = arg("style", "clean"); // clean | cleanlight | default
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
  const links = listPairs(arg("links", ""));
  const rightNote = arg("right_note", "Let’s build something");

  const svg = renderHero({
    theme,
    style,
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
}

main();
