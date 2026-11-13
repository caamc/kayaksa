// Meet Studio engine: the camera look used in Meet Studio and in every meeting and call.
// Designed and developed by Kayak Strategic Advisors. Everything runs on the person's own device;
// nothing about their camera image is sent anywhere except the finished video in a meeting.
// With every setting at its default, the camera goes out exactly as it comes in.

export const STUDIO_DEFAULT = {
  // light
  bright: 0, contrast: 0, light: false, key: 0, vig: 0, exposure: 0,
  // colour
  sat: 0, warm: 0, tint: 0, look: "none",
  // touch-up
  soft: 0,
  // framing
  zoom: 1, panx: 0, pany: 0, flip: false,
  // background
  bg: "none", blurAmt: 16, bgColor: "#0E2F3C",
  // privacy
  faceBlur: false,
  // overlays
  tag: false, tagName: "", tagTitle: "", brand: false,
};
export const LOOKS = [
  ["none", "Natural"], ["studio", "Studio"], ["cinema", "Cinematic"], ["bright", "Bright and airy"], ["warm", "Warm"], ["cool", "Cool"],
  ["mono", "Black and white"], ["vintage", "Vintage"], ["vivid", "Vivid"], ["matte", "Matte"],
];
const LOOK_FILTER = {
  none: "", studio: " contrast(1.05) saturate(1.06)", cinema: " contrast(1.12) saturate(1.12)", bright: " brightness(1.08) contrast(0.96) saturate(1.04)",
  warm: " sepia(0.16) saturate(1.1)", cool: " hue-rotate(-8deg) saturate(1.04)", mono: " grayscale(1) contrast(1.08)", vintage: " sepia(0.35) contrast(0.94) saturate(0.85)",
  vivid: " saturate(1.35) contrast(1.06)", matte: " contrast(0.88) brightness(1.04) saturate(0.92)",
};
const LOOK_TINT = { cinema: ["#0F6F7A", 0.12, "soft-light"], cool: ["#3B82C4", 0.08, "soft-light"], warm: ["#E9A04B", 0.07, "soft-light"], vintage: ["#C9A36A", 0.1, "overlay"] };

export function loadStudio() { try { return { ...STUDIO_DEFAULT, ...JSON.parse(localStorage.getItem("km:studio") || "{}") }; } catch { return { ...STUDIO_DEFAULT }; } }
export function saveStudio(t) { try { localStorage.setItem("km:studio", JSON.stringify(t)); } catch {} }

/** True when any setting changes the picture (otherwise the raw camera is used). */
export function isActive(t) {
  return !!(t.bright || t.contrast || t.light || t.key || t.vig || t.exposure || t.sat || t.warm || t.tint || (t.look && t.look !== "none") || t.soft ||
    t.zoom > 1.001 || t.panx || t.pany || t.flip || t.bg !== "none" || t.faceBlur || t.tag || t.brand);
}
export const needsMask = (t) => t.bg !== "none" || t.faceBlur;

export function filterOf(t) {
  const b = 1 + t.bright / 100 + (t.light ? 0.12 : 0) + (t.exposure || 0) / 120, c = 1 + t.contrast / 100 - (t.light ? 0.04 : 0), sat = 1 + t.sat / 100;
  let f = `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${sat.toFixed(3)})`;
  if (t.warm > 0) f += ` sepia(${(t.warm / 260).toFixed(3)})`; else if (t.warm < 0) f += ` hue-rotate(${(t.warm / 6).toFixed(1)}deg) saturate(${(1 + t.warm / 400).toFixed(3)})`;
  if (t.tint) f += ` hue-rotate(${(t.tint / 3).toFixed(1)}deg)`;
  return f + (LOOK_FILTER[t.look] || "");
}

/** Camera constraints from the Quality and Sound settings. */
export function constraints(devices = {}) {
  const ls = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const res = { "360": [640, 360], "540": [960, 540], "720": [1280, 720], "1080": [1920, 1080] }[ls("km:res", "720")] || [1280, 720];
  const fps = Number(ls("km:fps", "24")) || 24;
  const hdOff = ls("km:hd", "1") === "0";
  const [w, h] = hdOff ? [640, 360] : res;
  return {
    audio: { echoCancellation: ls("km:ec", "1") !== "0", noiseSuppression: ls("km:ns", "1") !== "0", autoGainControl: ls("km:ag", "1") !== "0", ...(devices.mic ? { deviceId: { exact: devices.mic } } : {}) },
    video: { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fps, max: Math.max(30, fps) }, ...(devices.cam ? { deviceId: { exact: devices.cam } } : {}) },
  };
}

let customBg = null, customKey = "";
/** The person's own background picture, kept on this device only. */
export function customBackground() {
  let d = ""; try { d = localStorage.getItem("km:studio-bg") || ""; } catch {}
  if (!d) { customBg = null; customKey = ""; return null; }
  if (d !== customKey) { customKey = d; const im = new Image(); im.onload = () => { if (customKey === d) customBg = im; }; im.src = d; }
  return customBg;
}
let logo = null;
function brandLogo() { if (!logo) { logo = new Image(); logo.src = "/_shared/logos/MeetByKayak_Logo_Reversed.svg"; } return logo.complete && logo.naturalWidth ? logo : null; }

const cover = (ctx, img, W, H) => { const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); };

/**
 * Draws one frame. env: { mask (segmentation mask or null), bgImg (Kayak background image or null) }.
 * The caller sends `video` frames to the segmenter separately when needsMask(t).
 */
export function drawFrame(ctx, canvas, video, t, env = {}) {
  if (video.readyState < 2 || !video.videoWidth) return;
  const W = canvas.width, H = canvas.height;
  const z = Math.max(1, Math.min(2.2, t.zoom || 1)), vw = video.videoWidth, vh = video.videoHeight;
  const sw = vw / z, sh = vh / z;
  const sx = Math.max(0, Math.min(vw - sw, (vw - sw) / 2 + (t.panx || 0) / 100 * (vw - sw) / 2));
  const sy = Math.max(0, Math.min(vh - sh, (vh - sh) / 2 - (vh - sh) * 0.15 + (t.pany || 0) / 100 * (vh - sh) / 2)); // a little headroom
  const f = filterOf(t);
  const cam = (filter) => { ctx.save(); ctx.filter = filter; if (t.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); } ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); ctx.restore(); };
  const mask = env.mask;
  const background = () => {
    if (t.bg === "blur") return cam(`blur(${Math.max(4, Math.min(40, t.blurAmt || 16))}px) ${f}`);
    if (t.bg === "color") { ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(t.bgColor) ? t.bgColor : "#0E2F3C"; return ctx.fillRect(0, 0, W, H); }
    if (t.bg === "custom") { const im = customBackground(); if (im) return cover(ctx, im, W, H); }
    if (env.bgImg && t.bg.startsWith("kayak-")) return cover(ctx, env.bgImg, W, H);
    if (t.bg === "none") return cam(f);
    ctx.fillStyle = "#0E2F3C"; ctx.fillRect(0, 0, W, H);
  };
  ctx.save();
  if (t.faceBlur) {
    // Privacy: the person is blurred beyond recognition; until the mask is ready, the whole picture is.
    if (!mask) { cam(`blur(28px) ${f}`); }
    else {
      ctx.globalCompositeOperation = "copy"; ctx.filter = "blur(4px)";
      if (t.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.drawImage(mask, sx, sy, sw, sh, 0, 0, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-in"; cam(`blur(30px) ${f}`);
      ctx.globalCompositeOperation = "destination-over"; background();
    }
  } else if (t.bg !== "none" && mask) {
    ctx.globalCompositeOperation = "copy"; ctx.filter = "blur(3px)";
    if (t.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(mask, sx, sy, sw, sh, 0, 0, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0); // the person, as a soft-edged mask
    ctx.globalCompositeOperation = "source-in"; cam(f);                                 // the person, with the look
    ctx.globalCompositeOperation = "destination-over"; background();
  } else cam(f);
  ctx.restore();
  // Light and finish
  const tint = LOOK_TINT[t.look];
  if (tint) { ctx.save(); ctx.globalAlpha = tint[1]; ctx.globalCompositeOperation = tint[2]; ctx.fillStyle = tint[0]; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (t.key > 0) { ctx.save(); const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.55); g.addColorStop(0, `rgba(255,248,236,${(t.key / 100) * 0.42})`); g.addColorStop(1, "rgba(255,248,236,0)"); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (t.soft > 0) { ctx.save(); ctx.globalAlpha = (t.soft / 100) * 0.42; ctx.filter = `blur(${2 + t.soft / 30}px)`; ctx.globalCompositeOperation = "lighten"; ctx.drawImage(canvas, 0, 0); ctx.restore(); }
  if (t.vig > 0) { ctx.save(); const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${(t.vig / 100) * 0.7})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  // Overlays (never mirrored)
  if (t.tag && (t.tagName || t.tagTitle)) {
    const s = H / 720, x = 28 * s, h = (t.tagTitle ? 66 : 46) * s, y = H - h - 28 * s;
    ctx.save(); ctx.font = `800 ${22 * s}px Archivo, "Segoe UI", system-ui, sans-serif`;
    const w1 = ctx.measureText(t.tagName || "").width; ctx.font = `500 ${16 * s}px Archivo, "Segoe UI", system-ui, sans-serif`;
    const w = Math.max(w1, ctx.measureText(t.tagTitle || "").width) + 44 * s;
    ctx.fillStyle = "rgba(14,47,60,.86)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 10 * s) : ctx.rect(x, y, w, h); ctx.fill();
    ctx.fillStyle = "#EE9B1E"; ctx.fillRect(x, y + 10 * s, 4 * s, h - 20 * s);
    ctx.fillStyle = "#fff"; ctx.font = `800 ${22 * s}px Archivo, "Segoe UI", system-ui, sans-serif`; ctx.fillText(t.tagName || "", x + 20 * s, y + 30 * s);
    if (t.tagTitle) { ctx.fillStyle = "#C9D8DC"; ctx.font = `500 ${16 * s}px Archivo, "Segoe UI", system-ui, sans-serif`; ctx.fillText(t.tagTitle, x + 20 * s, y + 54 * s); }
    ctx.restore();
  }
  if (t.brand) { const lg = brandLogo(); if (lg) { const w = W * 0.16, h = w * (lg.naturalHeight / lg.naturalWidth); ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(lg, W - w - W * 0.025, H * 0.035, w, h); ctx.restore(); } }
}
