// scripts/marketing.mjs
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
              fill="${t.chipBg}" stroke="rgba(0,0,0,0.06)"/>
        <text x="${x + padX}" y="${y + 15}" font-size="${fs}"
              fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>
      </g>`,
  };
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
            fill="url(#ctaGrad)" stroke="${t.border}"/>
      <text x="${tx}" y="${y + Math.floor(h * 0.68)}" font-size="${fs}" font-weight="900"
            fill="${t.buttonText || "#0b1020"}" font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
    </g>`;
  return linkWrap(url, inner);
}

function featureRow({ x, y, t, text }) {
  const fs = 12;
  const icon = `
    <g transform="translate(${x},${y})">
      <circle cx="6" cy="6" r="6" fill="${t.accent}" opacity="0.95"/>
      <text x="6" y="10" text-anchor="middle" font-size="10" font-weight="900"
            fill="${t.okText || "#ffffff"}" font-family="Segoe UI, Ubuntu, Arial">✓</text>
    </g>`;
  const label = `<text x="${x + 18}" y="${y + 11}" font-size="${fs}"
                  fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(text)}</text>`;
  return icon + label;
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

function applyStyle(t, style) {
  // “clean” = màu marketing kiểu corporate, ít chói
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

  // “cleanlight” = light mode nhìn sạch + không chói
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

  // default
  return {
    ...t,
    pillBg: "rgba(255,255,255,0.06)",
    pillStroke: "rgba(255,255,255,0.06)",
    buttonText: t.bg, // như bạn đang dùng
    okText: t.bg,
  };
}

function renderHero(opts) {
  // theme vẫn dùng được, nhưng style sẽ override cho đẹp hơn
  let t = resolveTheme(opts.theme);
  t = applyStyle(t, opts.style);

  const CANVAS_W = opts.width;
  const OUT = 18;
  const W = CANVAS_W - OUT * 2;

  const PAD = 26;

  // ✅ FIX TRÀN: đã translate(OUT,OUT) rồi => INNER_X/Y phải = 0
  const INNER_X = 0;
  const INNER_Y = 0;

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

  const rightCardTop = 54;
  const statH = 48;
  const statGap = 10;
  const rightMinH = rightCardTop + stats.length * (statH + statGap) + 52;

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

    <filter id="shadow" x="-18%" y="-22%" width="140%" height="170%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="${t.shadow}"/>
    </filter>

    <!-- ✅ Clip để blob/nội dung không lòi ra ngoài bo góc -->
    <clipPath id="cardClip">
      <rect x="0" y="0" width="${W}" height="${H_INNER}" rx="16" />
    </clipPath>
  </defs>`;

  // blob nền (đã giảm opacity + sẽ bị clip)
  const blob = `
    <g opacity="0.55">
      <circle cx="${W - 70}" cy="46" r="40" fill="${t.grad2 || t.accent}" opacity="0.22"/>
      <circle cx="${W - 140}" cy="90" r="64" fill="${t.grad1 || t.title}" opacity="0.16"/>
      <circle cx="90" cy="${H_INNER - 30}" r="70" fill="${t.grad1 || t.title}" opacity="0.10"/>
    </g>`;

  const monogram =
    (title || "DK")
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

  let descSvg = "";
  for (let i = 0; i < descLines.length; i++) {
    descSvg += `<text x="${INNER_X + PAD}" y="${INNER_Y + y + i * 18}"
                    font-size="13" fill="${t.text}" font-family="Segoe UI, Ubuntu, Arial">${esc(descLines[i])}</text>`;
  }
  y += descLines.length * 18 + 16;

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

  const divider = `<rect x="${INNER_X + PAD}" y="${INNER_Y + y}" width="${leftW}" height="1" fill="${t.track}" opacity="0.95"/>`;
  y += 16;

  let pointsSvg = "";
  let py = INNER_Y + y;
  for (const p of points) {
    pointsSvg += featureRow({ x: INNER_X + PAD, y: py, t, text: p });
    py += 22;
  }
  y += points.length * 22 + 12;

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
                fill="${t.pillBg}" stroke="${t.pillStroke}"/>
          <text x="${lx + 12}" y="${ly + 15}" font-size="11" fill="${t.muted}"
                font-family="Segoe UI, Ubuntu, Arial">${esc(label)}</text>
        </g>`;
      linksSvg += linkWrap(b, inner);
      lx += w + 8;
      if (lx > INNER_X + PAD + leftW - 60) break;
    }
  }

  const rx = INNER_X + PAD + leftW + PAD;

  const rightHeader = `
    <g transform="translate(${rx},${INNER_Y + 24})">
      <circle cx="18" cy="18" r="18" fill="${t.pillBg}" />
      <text x="18" y="24" text-anchor="middle" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">⚡</text>
      <text x="46" y="18" font-size="14" font-weight="900"
            fill="${t.title}" font-family="Segoe UI, Ubuntu, Arial">Quick facts</text>
      <text x="46" y="38" font-size="11"
            fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">${esc(opts.rightNote)}</text>
    </g>`;

  let statsSvg = "";
  let sy = INNER_Y + 54;
  const statW = rightW;
  for (const { a, b } of stats) {
    statsSvg += statPill({ x: rx, y: sy, w: statW, h: 48, t, k: a, v: b });
    sy += 48 + 10;
  }

  const footer = `<text x="${INNER_X + PAD}" y="${INNER_Y + H_INNER - 16}"
                   font-size="10" fill="${t.muted}" font-family="Segoe UI, Ubuntu, Arial">self-built • actions → svg</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     role="img" aria-label="${esc(title)}">
  ${defs}
  <g transform="translate(${OUT},${OUT})">
    <rect x="0.5" y="0.5" width="${W - 1}" height="${H_INNER - 1}" rx="16"
          fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="1.2" filter="url(#shadow)"/>

    <!-- ✅ Tất cả thứ dễ “tràn” nằm trong clip -->
    <g clip-path="url(#cardClip)">
      ${blob}
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
  </g>
</svg>`;
}

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
