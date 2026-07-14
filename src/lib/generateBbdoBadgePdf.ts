import jsPDF from "jspdf";
import { BbdoBadge } from "./globalStreak";

// Load an image URL as a circular PNG dataURL sized to `size` px.
async function loadAvatarCircle(url: string, size = 320): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // Cover-fit
    const iw = img.width;
    const ih = img.height;
    const scale = Math.max(size / iw, size / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    ctx.restore();
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Build a monogram dataURL when no avatar exists.
function makeMonogram(letter: string, size = 320): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#248CCB");
  g.addColorStop(1, "#E00101");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${size * 0.5}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.toUpperCase(), size / 2, size / 2 + 6);
  return c.toDataURL("image/png");
}

// Draw a filled 5-point star centered at (cx, cy) with outer radius r.
function drawStar(pdf: jsPDF, cx: number, cy: number, r: number, rgb: [number, number, number], alpha = 1) {
  const inner = r * 0.4;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const gs = (pdf as any).GState ? new (pdf as any).GState({ opacity: alpha }) : null;
  if (gs) (pdf as any).setGState(gs);
  const lines: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    lines.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  pdf.lines(lines, pts[0][0], pts[0][1], [1, 1], "F", true);
  if (gs) {
    const reset = new (pdf as any).GState({ opacity: 1 });
    (pdf as any).setGState(reset);
  }
}

function drawSparkle(pdf: jsPDF, cx: number, cy: number, r: number, rgb: [number, number, number], alpha = 1) {
  const gs = (pdf as any).GState ? new (pdf as any).GState({ opacity: alpha }) : null;
  if (gs) (pdf as any).setGState(gs);
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
  pdf.setLineWidth(1.2);
  pdf.line(cx - r, cy, cx + r, cy);
  pdf.line(cx, cy - r, cx, cy + r);
  pdf.setLineWidth(0.6);
  pdf.line(cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6);
  pdf.line(cx - r * 0.6, cy + r * 0.6, cx + r * 0.6, cy - r * 0.6);
  if (gs) {
    const reset = new (pdf as any).GState({ opacity: 1 });
    (pdf as any).setGState(reset);
  }
}

// Simulated gradient wash by stacking translucent horizontal bands.
function drawGradientWash(pdf: jsPDF, x: number, y: number, w: number, h: number, from: [number, number, number], to: [number, number, number]) {
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    pdf.setFillColor(r, g, b);
    pdf.rect(x, y + (h / steps) * i, w, h / steps + 0.6, "F");
  }
}

export async function generateBbdoBadgePdf(
  badge: BbdoBadge,
  meta: { name: string; avatarUrl: string | null }
): Promise<void> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // 1) Background: navy → indigo → crimson gradient wash
  drawGradientWash(pdf, 0, 0, W, H, [12, 20, 48], [46, 20, 70]);
  // Bottom crimson glow
  drawGradientWash(pdf, 0, H * 0.55, W, H * 0.45, [46, 20, 70], [176, 34, 55]);

  // 2) Confetti stars + sparkles scattered (deterministic pseudo-random)
  const rand = (() => {
    let seed = (badge.period_number || 1) * 9973 + (badge.badge_type === "monthly" ? 7 : 3);
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0xffff;
    };
  })();
  const starColors: [number, number, number][] = [
    [255, 209, 102], // gold
    [255, 255, 255], // white
    [255, 138, 138], // coral
    [147, 197, 253], // ice blue
  ];
  for (let i = 0; i < 55; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 3 + rand() * 7;
    const c = starColors[Math.floor(rand() * starColors.length)];
    const a = 0.35 + rand() * 0.55;
    if (i % 3 === 0) drawStar(pdf, x, y, r, c, a);
    else drawSparkle(pdf, x, y, r, c, a);
  }

  // 3) Top wordmark
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("B B D O   ·   BYE BYE DIABETES & OBESITY", W / 2, 46, { align: "center" });

  // 4) Avatar circle centered near top
  const avatarSize = 130;
  const avatarX = W / 2 - avatarSize / 2;
  const avatarY = 70;
  // Ring
  drawGradientWash(pdf, avatarX - 6, avatarY - 6, avatarSize + 12, avatarSize + 12, [30, 58, 138], [230, 57, 70]);
  // Punch the circle back to bg using an ellipse mask via white ring border
  const dataUrl =
    (meta.avatarUrl ? await loadAvatarCircle(meta.avatarUrl, 320) : null) ||
    makeMonogram((meta.name || "B").charAt(0));
  pdf.addImage(dataUrl, "PNG", avatarX, avatarY, avatarSize, avatarSize, undefined, "FAST");

  // 5) Badge type chip
  const chipLabel = badge.badge_type === "monthly"
    ? `MONTHLY · #${badge.period_number}`
    : `WEEK ${badge.period_number}`;
  pdf.setFillColor(255, 255, 255);
  const chipW = pdf.getTextWidth(chipLabel) + 28;
  const chipX = W / 2 - chipW / 2;
  const chipY = avatarY + avatarSize + 14;
  pdf.roundedRect(chipX, chipY, chipW, 22, 11, 11, "F");
  pdf.setTextColor(15, 26, 61);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(chipLabel, W / 2, chipY + 15, { align: "center" });

  // 6) Headline — always white
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  const headline = badge.badge_type === "monthly"
    ? `A full month, ${meta.name}.`
    : `One week completed, ${meta.name}.`;
  pdf.text(headline, W / 2, chipY + 60, { align: "center" });

  // 7) Date range
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(220, 225, 245);
  const dateStr = `${new Date(badge.period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}  —  ${new Date(badge.period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  pdf.text(dateStr, W / 2, chipY + 82, { align: "center" });

  // 8) Delta pills (weight, glucose) — only if data present
  const s: any = badge.snapshot || {};
  let cardsY = chipY + 110;
  const deltas: { label: string; from: number; to: number; unit: string; betterDown: boolean }[] = [];
  if (s.weight_start != null && s.weight_end != null) deltas.push({ label: "Weight", from: Number(s.weight_start), to: Number(s.weight_end), unit: "kg", betterDown: true });
  if (s.glucose_start != null && s.glucose_end != null) deltas.push({ label: "Glucose", from: Number(s.glucose_start), to: Number(s.glucose_end), unit: "mg/dL", betterDown: true });

  if (deltas.length) {
    const gap = 16;
    const cardW = (W - 80 - gap * (deltas.length - 1)) / deltas.length;
    const cardH = 78;
    deltas.forEach((d, i) => {
      const x = 40 + i * (cardW + gap);
      pdf.setFillColor(255, 255, 255);
      (pdf as any).setGState(new (pdf as any).GState({ opacity: 0.08 }));
      pdf.roundedRect(x, cardsY, cardW, cardH, 12, 12, "F");
      (pdf as any).setGState(new (pdf as any).GState({ opacity: 1 }));
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(x, cardsY, cardW, cardH, 12, 12, "S");

      pdf.setTextColor(200, 210, 235);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(d.label.toUpperCase(), x + 14, cardsY + 20);

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text(`${d.from.toFixed(1)}  →  ${d.to.toFixed(1)}`, x + 14, cardsY + 46);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(220, 225, 245);
      pdf.text(d.unit, x + 14, cardsY + 62);

      const delta = d.to - d.from;
      const better = d.betterDown ? delta < 0 : delta > 0;
      pdf.setTextColor(...(better ? [16, 185, 129] : [245, 158, 11]) as [number, number, number]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const arrow = delta === 0 ? "=" : delta < 0 ? "v" : "^";
      pdf.text(`${arrow} ${Math.abs(delta).toFixed(1)} ${d.unit}`, x + cardW - 14, cardsY + 46, { align: "right" });
    });
    cardsY += cardH + 18;
  }

  // 9) Totals grid (only pillars with data — hyperdynamic)
  const stats: { label: string; value: string; sub?: string }[] = [];
  if (Number(s.total_steps)) stats.push({ label: "Steps", value: Number(s.total_steps).toLocaleString(), sub: `over ${s.complete_days ?? 0} days` });
  if (Number(s.total_water_glasses)) stats.push({ label: "Water", value: `${Number(s.total_water_glasses)}`, sub: "glasses" });
  if (Number(s.total_exercise_min)) stats.push({ label: "Exercise", value: `${Number(s.total_exercise_min)}`, sub: "minutes" });
  if (Number(s.total_yoga_min)) stats.push({ label: "Yoga", value: `${Number(s.total_yoga_min)}`, sub: "minutes" });
  if (Number(s.total_supplements)) stats.push({ label: "Supplements", value: `${Number(s.total_supplements)}`, sub: "taken" });
  if (Number(s.total_fasting_hours)) stats.push({ label: "Fasting", value: `${Math.round(Number(s.total_fasting_hours))}`, sub: "hours" });
  stats.push({ label: "Complete days", value: `${s.complete_days ?? 0}`, sub: "in a row" });

  const cols = 2;
  const gap = 16;
  const cardW = (W - 80 - gap * (cols - 1)) / cols;
  const cardH = 74;
  stats.forEach((st, i) => {
    const cx = 40 + (i % cols) * (cardW + gap);
    const cy = cardsY + Math.floor(i / cols) * (cardH + gap);
    (pdf as any).setGState(new (pdf as any).GState({ opacity: 0.08 }));
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cx, cy, cardW, cardH, 12, 12, "F");
    (pdf as any).setGState(new (pdf as any).GState({ opacity: 1 }));
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(cx, cy, cardW, cardH, 12, 12, "S");

    pdf.setTextColor(200, 210, 235);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(st.label.toUpperCase(), cx + 14, cy + 20);

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text(st.value, cx + 14, cy + 48);

    if (st.sub) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(220, 225, 245);
      pdf.text(st.sub, cx + 14, cy + 64);
    }
  });

  // 10) Footer — always white/light on dark
  pdf.setFontSize(9);
  pdf.setTextColor(230, 235, 250);
  pdf.setFont("helvetica", "bold");
  pdf.text("byebyediabetesandobesity.com", W / 2, H - 44, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(200, 210, 235);
  pdf.text("Keep the streak alive.", W / 2, H - 28, { align: "center" });

  const safeName = (meta.name || "champion").replace(/\s+/g, "_");
  const suffix = badge.badge_type === "monthly" ? `Month-${badge.period_number}` : `Week-${badge.period_number}`;
  pdf.save(`BBDO-${suffix}-${safeName}.pdf`);
}
