/* Verse posters: hand-lettered designs drawn on a canvas, so the on-screen poster and the downloaded PNG are identical.
   Usage: await Poster.draw(canvas, { text, ref, style, seed }, width)   |   Poster.download(canvas, name)                     */
"use strict";
const Poster = (() => {
  const W = 1080, H = 1350;
  const FONT_SPECS = ['700 80px "Amatic SC"', '400 80px "Kaushan Script"', '400 80px "Caveat Brush"', '400 80px "Parisienne"', '600 40px "Josefin Sans"', '300 40px "Josefin Sans"', '600 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"'];
  let fontsReady = null;
  const loadFonts = () => fontsReady || (fontsReady = Promise.race([Promise.allSettled(FONT_SPECS.map(s => document.fonts.load(s, "Aa Love"))), new Promise(r => setTimeout(r, 3500))]));

  /* ---------- seeded randomness: the same verse always gets the same artwork ---------- */
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  /* ---------- shapes ---------- */
  function blob(c, cx, cy, r, rnd, n = 8, j = .28) {
    const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - j + rnd() * j * 2); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * (.8 + rnd() * .4)]); }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; let m = mid(pts[n - 1], pts[0]);
    c.beginPath(); c.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mm = mid(p, q); c.quadraticCurveTo(p[0], p[1], mm[0], mm[1]); }
    c.closePath();
  }
  const fillBlob = (c, color, ...a) => { blob(c, ...a); c.fillStyle = color; c.fill(); };
  function heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * .9); c.bezierCurveTo(x - s * 1.3, y - s * .1, x - s * .6, y - s * 1, x, y - s * .35); c.bezierCurveTo(x + s * .6, y - s * 1, x + s * 1.3, y - s * .1, x, y + s * .9); c.closePath(); }
  function sparkle(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.closePath(); }
  function leaf(c, x, y, len, wid, ang, fill, vein) {
    c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * .5, -wid, len, 0); c.quadraticCurveTo(len * .5, wid, 0, 0); c.fillStyle = fill; c.fill();
    c.strokeStyle = vein; c.lineWidth = 3; c.beginPath(); c.moveTo(len * .06, 0); c.lineTo(len * .9, 0); c.stroke(); c.restore();
  }
  function hill(c, y, amp, freq, phase, color) { c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 12) c.lineTo(x, y + Math.sin(x / W * freq * Math.PI * 2 + phase) * amp); c.lineTo(W, H); c.closePath(); c.fillStyle = color; c.fill(); }
  const dot = (c, x, y, r, color) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
  const stroke = (c, color, w, fn) => { c.strokeStyle = color; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); fn(c); c.stroke(); };
  const J = (rnd, n) => (rnd() - .5) * 2 * n;      // jitter

  /* ---------- the designs ---------- */
  const STYLES = {
    blush: {
      label: "Blush", align: "center", valign: "middle", halo: { color: "#f9b8c9", w: 16 }, box: { x: 110, y: 200, w: 860, h: 900 },
      fonts: { A: { script: 1, family: "Kaushan Script", size: 230, colors: ["#ee7d96", "#e8708a"] }, B: { family: "Amatic SC", weight: 700, size: 125, color: "#b277c6", upper: 1 }, C: { family: "Amatic SC", weight: 700, size: 78, color: "#4a3a73", upper: 1 } },
      bg(c, r) {
        c.fillStyle = "#f9b8c9"; c.fillRect(0, 0, W, H);
        fillBlob(c, "#a766b4", 120 + J(r, 30), 40 + J(r, 20), 270, r); fillBlob(c, "#c58bc4", 640 + J(r, 40), -20, 210, r);
        dot(c, 735 + J(r, 20), 125 + J(r, 15), 54, "#f5eaa3");
        fillBlob(c, "#6a4b8f", 1020, 430 + J(r, 40), 240, r); c.fillStyle = "#f08aa0"; heart(c, 925 + J(r, 20), 380, 78); c.fill();
        fillBlob(c, "#7c4f9f", 20, 790 + J(r, 40), 260, r);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) dot(c, 60 + k * 36 + (i % 2) * 14, 930 + i * 34, 11, "#f2e49a");
        fillBlob(c, "#a766b4", 520 + J(r, 60), 1370, 360, r, 9); fillBlob(c, "#f4a0a8", 1060, 1010 + J(r, 40), 210, r);
        stroke(c, "#f08aa0", 7, k => { heart(k, 235, 1190, 105); });
        stroke(c, "#f2e49a", 9, k => { k.moveTo(690, 130); k.quadraticCurveTo(790, 60, 880, 70); k.moveTo(740, 190); k.quadraticCurveTo(840, 120, 950, 110); });
        stroke(c, "#f2e49a", 9, k => { k.moveTo(880, 1260); k.quadraticCurveTo(960, 1190, 1060, 1180); k.moveTo(830, 1310); k.quadraticCurveTo(930, 1250, 1050, 1250); });
      },
      ref(c, label, info) { c.font = '700 50px "Amatic SC"'; c.fillStyle = "#4a3a73"; c.textAlign = "right"; c.fillText(label.toUpperCase(), 905, info.top - 18); },
      mark: { x: W / 2, y: 1318, color: "rgba(255,255,255,.85)" },
    },
    sunset: {
      label: "Sunset", align: "left", valign: "top", uniform: 1, box: { x: 130, y: 170, w: 820, h: 760 },
      fonts: { C: { family: "Caveat Brush", size: 92, color: "#1d1815" } },
      bg(c, r) {
        c.fillStyle = "#f2e6d3"; c.fillRect(0, 0, W, H); dot(c, 800 + J(r, 30), 230 + J(r, 20), 125, "#fbf5ec");
        hill(c, 930, 45, 1.2, r() * 6, "#f4b67f"); hill(c, 1000, 50, 1.6, r() * 6, "#f08c5f"); hill(c, 1075, 40, 1.3, r() * 6, "#e8735a"); hill(c, 1170, 30, 1.8, r() * 6, "#8c4b2c");
      },
      ref(c, label, info) { c.font = 'italic 500 38px "Cormorant Garamond"'; c.fillStyle = "#6b4a3a"; c.textAlign = "left"; c.fillText(label, 140, Math.min(info.end + 70, 900)); },
      mark: { x: W / 2, y: 1316, color: "rgba(242,230,211,.85)" },
    },
    watercolor: {
      label: "Watercolor", align: "center", valign: "middle", box: { x: 150, y: 380, w: 800, h: 740 },
      fonts: { A: { script: 1, family: "Parisienne", size: 215, color: "#1b1b1b" }, B: { script: 1, family: "Parisienne", size: 150, color: "#232a30" }, C: { family: "Josefin Sans", weight: 600, size: 50, color: "#3a3f44", upper: 1 } },
      bg(c, r) {
        c.fillStyle = "#f3f3f1"; c.fillRect(0, 0, W, H);
        c.strokeStyle = "rgba(0,0,0,.035)"; c.lineWidth = 1; for (let x = 0; x < W; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        const wash = (x, y, rad, a, col) => { const g = c.createRadialGradient(x, y, rad * .1, x, y, rad); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.7, `rgba(${col},${a * .55})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H); };
        for (let i = 0; i < 16; i++) wash(60 + r() * 520, 40 + r() * 420, 190 + r() * 200, .13 + r() * .1, i % 3 ? "96,150,176" : "74,124,152");
        wash(150, 210, 330, .22, "86,138,166");
        c.strokeStyle = "rgba(70,120,150,.28)"; c.lineWidth = 3; for (let i = 0; i < 3; i++) { blob(c, 160 + r() * 300, 150 + r() * 260, 140 + r() * 120, r, 9, .25); c.stroke(); }
        for (let i = 0; i < 9; i++) dot(c, 70 + r() * 200, 480 + r() * 260, 3 + r() * 9, "rgba(80,130,158,.22)");
      },
      ref(c, label, info) { c.font = '600 32px "Josefin Sans"'; c.fillStyle = "#3a3f44"; c.textAlign = "right"; c.fillText(label.toUpperCase(), 930, info.end + 64); },
      mark: { x: 150, y: 1310, align: "left", color: "rgba(60,70,80,.6)" },
    },
    midnight: {
      label: "Midnight", align: "center", valign: "middle", box: { x: 130, y: 210, w: 820, h: 880 },
      fonts: { A: { script: 1, family: "Parisienne", size: 215, colors: ["#f0cf9f", "#e2b277"] }, B: { family: "Cormorant Garamond", weight: 600, style: "italic", size: 118, color: "#ead3b0" }, C: { family: "Josefin Sans", weight: 300, size: 54, color: "#d8cde3", upper: 1 } },
      bg(c, r) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0f0c18"); g.addColorStop(1, "#27152b"); c.fillStyle = g; c.fillRect(0, 0, W, H);
        const glow = c.createRadialGradient(W / 2, 560, 40, W / 2, 560, 620); glow.addColorStop(0, "rgba(201,143,91,.22)"); glow.addColorStop(1, "rgba(201,143,91,0)"); c.fillStyle = glow; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 46; i++) { c.fillStyle = `rgba(240,207,159,${.25 + r() * .6})`; sparkle(c, r() * W, r() * H, 5 + r() * 12); c.fill(); }
        c.strokeStyle = "rgba(201,143,91,.65)"; c.lineWidth = 3; c.strokeRect(44, 44, W - 88, H - 88); c.lineWidth = 1; c.strokeRect(62, 62, W - 124, H - 124);
      },
      ref(c, label) { c.font = '600 36px "Josefin Sans"'; c.fillStyle = "#c98f5b"; c.textAlign = "center"; c.fillText(label.toUpperCase(), W / 2, 1178); stroke(c, "rgba(201,143,91,.7)", 2, k => { k.moveTo(250, 1166); k.lineTo(380, 1166); k.moveTo(700, 1166); k.lineTo(830, 1166); }); },
      mark: { x: W / 2, y: 1276, color: "rgba(176,160,196,.8)" },
    },
    meadow: {
      label: "Meadow", align: "center", valign: "middle", box: { x: 150, y: 250, w: 780, h: 840 },
      fonts: { A: { script: 1, family: "Parisienne", size: 210, colors: ["#5b7d45", "#6c8f50"] }, B: { family: "Amatic SC", weight: 700, size: 125, color: "#3d5d39", upper: 1 }, C: { family: "Josefin Sans", weight: 600, size: 50, color: "#2f4630", upper: 1 } },
      bg(c, r) {
        c.fillStyle = "#e7eedc"; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 3; i++) { c.strokeStyle = "rgba(111,143,82,.16)"; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, 640, 330 + i * 80, 0, Math.PI * 2); c.stroke(); }
        const cols = ["#7f9f63", "#9bbb80", "#6b8c52", "#b4cf99"];
        for (let i = 0; i < 9; i++) { leaf(c, -30 + r() * 120, H + 20 - r() * 100, 260 + r() * 200, 50 + r() * 30, -Math.PI / 2 + (r() - .2) * 1.6, cols[i % 4], "#5d7d47"); }
        for (let i = 0; i < 9; i++) { leaf(c, W + 30 - r() * 120, -20 + r() * 100, 260 + r() * 200, 50 + r() * 30, Math.PI / 2 + (r() - .8) * 1.6, cols[(i + 1) % 4], "#5d7d47"); }
        for (let i = 0; i < 16; i++) dot(c, 80 + r() * 920, 100 + r() * 1150, 3 + r() * 5, "rgba(95,125,70,.25)");
      },
      ref(c, label) { c.font = '600 34px "Josefin Sans"'; c.fillStyle = "#4a6a40"; c.textAlign = "center"; c.fillText(label.toUpperCase(), W / 2, 1180); },
      mark: { x: W / 2, y: 1262, color: "rgba(70,100,60,.6)" },
    },
    dawn: {
      label: "Dawn", align: "center", valign: "middle", box: { x: 130, y: 250, w: 820, h: 860 },
      fonts: { A: { script: 1, family: "Kaushan Script", size: 215, colors: ["#b04f6b", "#c05b78"] }, B: { family: "Amatic SC", weight: 700, size: 125, color: "#6b4a8a", upper: 1 }, C: { family: "Amatic SC", weight: 700, size: 74, color: "#3a2a4d", upper: 1 } },
      bg(c, r) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#cdbfe9"); g.addColorStop(.55, "#ebcbe0"); g.addColorStop(1, "#f8d6bd"); c.fillStyle = g; c.fillRect(0, 0, W, H);
        const sun = c.createRadialGradient(W / 2, 1010, 20, W / 2, 1010, 460); sun.addColorStop(0, "rgba(255,240,210,.95)"); sun.addColorStop(.55, "rgba(255,226,190,.55)"); sun.addColorStop(1, "rgba(255,226,190,0)"); c.fillStyle = sun; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 7; i++) { c.fillStyle = `rgba(255,255,255,${.1 + r() * .12})`; c.beginPath(); c.arc(100 + r() * 880, 120 + r() * 1100, 40 + r() * 150, 0, Math.PI * 2); c.fill(); }
        for (let i = 0; i < 3; i++) stroke(c, "rgba(255,255,255,.45)", 4, k => { k.arc(W / 2, 1010, 300 + i * 90, Math.PI * 1.15, Math.PI * 1.85); });
      },
      ref(c, label) { c.font = '600 34px "Josefin Sans"'; c.fillStyle = "#3a2a4d"; c.textAlign = "center"; c.fillText(label.toUpperCase(), W / 2, 168); },
      mark: { x: W / 2, y: 1308, color: "rgba(58,42,77,.55)" },
    },
  };

  /* ---------- typesetting ---------- */
  const STOP = new Set("the and but for nor yet with from into upon unto that this these those then than them they their there what when where which while whom whose will shall would should could have has had having been being were was are our your you his her its not any all one who how thou thy thee ye let may can did does done more most than also such even only very much many some".split(" "));
  function plan(text) {
    const words = text.replace(/\s+/g, " ").trim().split(" "), n = words.length;
    const cand = words.map((w, i) => { const core = w.toLowerCase().replace(/[^a-z'’-]/g, ""); return { i, sc: STOP.has(core) || core.length < 4 ? 0 : core.length + (i === n - 1 ? 1 : 0) }; });
    const K = n <= 9 ? 2 : n <= 18 ? 3 : n <= 30 ? 4 : 5, chosen = [];
    [...cand].sort((a, b) => b.sc - a.sc || a.i - b.i).forEach(cd => { if (chosen.length < K && cd.sc > 0 && chosen.every(o => Math.abs(o.i - cd.i) >= 3)) chosen.push(cd); });
    chosen.sort((a, b) => b.sc - a.sc);
    const tiers = new Array(n).fill("C"); chosen.forEach((cd, k) => { tiers[cd.i] = k < Math.ceil(chosen.length / 2) ? "A" : "B"; });
    return words.map((w, i) => ({ w, tier: tiers[i] }));
  }
  const fontOf = (st, tier, scale) => {
    const f = st.fonts[st.uniform ? "C" : tier], size = Math.max(14, Math.round(f.size * scale));
    return { css: `${f.style || ""} ${f.weight || 400} ${size}px "${f.family}", Georgia, serif`.trim(), size, f, tier };
  };
  function layout(c, tokens, st, scale) {
    const lines = []; let cur = null, a = 0;
    for (const tk of tokens) {
      const f = fontOf(st, tk.tier, scale), text = f.f.upper ? tk.w.toUpperCase() : tk.w;
      c.font = f.css; const w = c.measureText(text).width, solo = !st.uniform && tk.tier !== "C";
      let color = f.f.color; if (f.f.colors) { color = f.f.colors[a % f.f.colors.length]; a++; }
      const item = { text, w, css: f.css, color };
      if (solo) { cur = null; lines.push({ solo: true, items: [item], w, size: f.size, h: f.size * (f.f.script ? (tk.tier === "A" ? 1.44 : 1.36) : 1.1) }); continue; }
      const sp = f.size * .3;
      if (!cur || cur.w + sp + w > st.box.w) { cur = { items: [], w: 0, size: f.size, h: f.size * 1.22 }; lines.push(cur); }
      cur.w += (cur.items.length ? sp : 0) + w; cur.items.push(item);
    }
    return lines;
  }
  function typeset(c, text, st) {
    const tokens = plan(text); let scale = 1, lines, total;
    for (; scale > .24; scale -= .03) { lines = layout(c, tokens, st, scale); total = lines.reduce((s, l) => s + l.h, 0); if (total <= st.box.h && lines.every(l => l.w <= st.box.w + 2)) break; }
    let y = st.valign === "top" ? st.box.y : st.box.y + (st.box.h - total) / 2; const top = y;
    c.textBaseline = "alphabetic";
    for (const l of lines) {
      let x = st.align === "left" ? st.box.x : st.box.x + (st.box.w - l.w) / 2;
      const base = y + l.h * (l.solo ? .69 : .8);
      for (const it of l.items) {
        c.font = it.css; c.textAlign = "left";
        if (st.halo) { c.lineJoin = "round"; c.strokeStyle = st.halo.color; c.lineWidth = st.halo.w; c.strokeText(it.text, x, base); }
        c.fillStyle = it.color; c.fillText(it.text, x, base); x += it.w + l.size * .3;
      }
      y += l.h;
    }
    return { top, end: y, scale };
  }

  /* ---------- public ---------- */
  async function draw(canvas, spec, width = W) {
    await loadFonts();
    const st = STYLES[spec.style] || STYLES.midnight, s = width / W;
    canvas.width = width; canvas.height = Math.round(H * s);
    const c = canvas.getContext("2d"); c.setTransform(s, 0, 0, s, 0, 0);
    st.bg(c, rng(hash(spec.seed || spec.ref || spec.text)));
    const info = typeset(c, spec.text, st);
    if (st.ref && spec.ref) st.ref(c, spec.ref, info);
    if (st.mark) { c.font = 'italic 500 30px "Cormorant Garamond", Georgia, serif'; c.fillStyle = st.mark.color; c.textAlign = st.mark.align || "center"; c.fillText("Psyche & Soul", st.mark.x, st.mark.y); }
    canvas.dataset.style = spec.style; canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `${spec.ref}: ${spec.text}`);
  }
  function download(canvas, name) {
    canvas.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name + ".png"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
  }
  return { draw, download, styles: Object.entries(STYLES).map(([id, s]) => ({ id, label: s.label })), W, H };
})();
