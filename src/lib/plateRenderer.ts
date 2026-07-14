// Renders a "plate" composition to a PNG Blob (canvas, no deps).
// Items are drawn as circular thumbnails arranged on a plate background.

export interface PlateRenderItem {
  name: string;
  imageUrl?: string | null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function placeholderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 65% 75%)`;
}

export async function renderPlate(items: PlateRenderItem[], size = 1080): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background — warm off-white linen
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#FBF6EE");
  bg.addColorStop(1, "#F2E9D8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Plate shadow
  const cx = size / 2, cy = size / 2;
  const plateR = size * 0.44;
  ctx.save();
  ctx.shadowColor = "rgba(15,26,61,0.18)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, plateR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Plate inner ring
  ctx.strokeStyle = "rgba(15,26,61,0.08)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, plateR * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  const n = Math.max(items.length, 1);
  const ringR = plateR * 0.55;
  const thumbR = Math.min(plateR * 0.30, (Math.PI * 2 * ringR) / (n * 2.6));

  // Single item: center it
  const positions: { x: number; y: number }[] = [];
  if (n === 1) {
    positions.push({ x: cx, y: cy });
  } else {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      positions.push({ x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR });
    }
  }

  const images = await Promise.all(items.map((it) => (it.imageUrl ? loadImage(it.imageUrl) : Promise.resolve(null))));

  for (let i = 0; i < items.length; i++) {
    const { x, y } = positions[i];
    const it = items[i];
    const r = n === 1 ? plateR * 0.62 : thumbR;
    const img = images[i];

    // soft drop shadow under thumb
    ctx.save();
    ctx.shadowColor = "rgba(15,26,61,0.18)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = img ? "transparent" : placeholderColor(it.name);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      // cover-fit
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max((2 * r) / iw, (2 * r) / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
      ctx.restore();
    } else {
      // initial text
      ctx.fillStyle = "#0F1A3D";
      ctx.font = `bold ${Math.round(r * 0.6)}px Helvetica, Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(it.name.charAt(0).toUpperCase(), x, y);
    }
  }

  // Brand stamp
  ctx.fillStyle = "rgba(15,26,61,0.5)";
  ctx.font = `bold ${Math.round(size * 0.018)}px Helvetica, Inter, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("BYE BYE DIABETES · MY PLATE", size - 40, size - 30);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
}
