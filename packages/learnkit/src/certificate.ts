// Certificate of Participation, drawn with pdf-lib in Kayak's brand (A4 landscape).
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import archivoBold from "../../brand/fonts-ttf/ArchivoExpanded-Bold.ttf";
import archivoSemi from "../../brand/fonts-ttf/Archivo-SemiBold.ttf";
import archivoReg from "../../brand/fonts-ttf/Archivo-Regular.ttf";
import serifReg from "../../brand/fonts-ttf/SourceSerif4-Regular.ttf";
import serifItal from "../../brand/fonts-ttf/SourceSerif4-Italic.ttf";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const DEEP = hex("#0E2F3C"), WATER = hex("#17807E"), SAFFRON = hex("#EE9B1E"), SLATE = hex("#3E5563"), FOG = hex("#D4DEE2"), GOLD = hex("#9C630E");

// Kayak wordmark paths (master artwork, viewBox 416 x 100).
const K = "M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z";
const A = "M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z";
const STEM = "M32 51 L46 70 L60 51 L60 100 L32 100 Z";
const BL = "M0 0 L30 0 L44 26.25 L44 59.3 Z";
const BR = "M92 0 L62 0 L48 26.25 L48 59.3 Z";

export interface CertData {
  id: string;
  holder: string;
  title: string;
  kind: "course" | "path";
  issued: Date;
  minutes?: number;
  verifyUrl: string;
  issuer?: string;
}

export async function certificatePdf(d: CertData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificate of Participation — ${d.title}`);
  pdf.setAuthor("Kayak Strategic Advisors Private Limited");
  pdf.setSubject(`Certificate ${d.id}`);
  pdf.setCreator("learn.kayaksa.com");
  const [hBold, hSemi, hReg, sReg, sItal] = await Promise.all([archivoBold, archivoSemi, archivoReg, serifReg, serifItal].map((f) => pdf.embedFont(f as ArrayBuffer, { subset: true })));
  const W = 841.89, H = 595.28;
  const p = pdf.addPage([W, H]);

  const spaced = (text: string, o: { x: number; y: number; size: number; font: any; color: any }, gap: number) => {
    let x = o.x;
    for (const ch of text) {
      p.drawText(ch, { x, y: o.y, size: o.size, font: o.font, color: o.color });
      x += o.font.widthOfTextAtSize(ch, o.size) + gap;
    }
  };
  // Ground and frame
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hex("#FFFFFF") });
  p.drawRectangle({ x: 0, y: 0, width: 210, height: H, color: DEEP });
  p.drawRectangle({ x: 210, y: 0, width: 5, height: H, color: SAFFRON });
  p.drawRectangle({ x: 240, y: 24, width: W - 264, height: H - 48, borderColor: FOG, borderWidth: 0.8 });

  // Wordmark (white letters) in the band
  const s = 0.36, ox = 28, oy = H - 52;
  const wm = (d: string, dx: number, color = hex("#FFFFFF")) => p.drawSvgPath(d, { x: ox + dx * s, y: oy, scale: s, color });
  wm(K, 0); wm(A, 92); wm(STEM, 161); wm(A, 232); wm(K, 332);
  wm(BL, 161, hex("#3FB0A9")); wm(BR, 161, SAFFRON);
  spaced("STRATEGIC ADVISORS", { x: ox, y: oy - 52, size: 7.2, font: hSemi, color: hex("#A9C0C6") }, 2.2);

  // Large tone-on-tone identifier in the band
  const big = 2.2, bx = 30, by = 230;
  p.drawSvgPath(BL, { x: bx, y: by, scale: big, color: hex("#143A49") });
  p.drawSvgPath(BR, { x: bx, y: by, scale: big, color: hex("#143A49") });
  p.drawSvgPath(STEM, { x: bx, y: by, scale: big, color: hex("#143A49") });

  spaced("LEARN.KAYAKSA.COM", { x: 28, y: 44, size: 7, font: hSemi, color: hex("#A9C0C6") }, 1.6);

  // Content
  const L = 290;
  spaced("CERTIFICATE OF PARTICIPATION", { x: L, y: H - 110, size: 11, font: hSemi, color: WATER }, 2.6);
  p.drawRectangle({ x: L, y: H - 126, width: 44, height: 3, color: SAFFRON });
  p.drawText("This is to certify that", { x: L, y: H - 170, size: 13, font: sItal, color: SLATE });

  const fit = (text: string, font: any, max: number, start: number, min: number) => {
    let size = start;
    while (size > min && font.widthOfTextAtSize(text, size) > max) size -= 1;
    return size;
  };
  const nameSize = fit(d.holder, hBold, W - L - 60, 34, 18);
  p.drawText(d.holder, { x: L, y: H - 215, size: nameSize, font: hBold, color: DEEP });
  p.drawLine({ start: { x: L, y: H - 232 }, end: { x: W - 60, y: H - 232 }, thickness: 0.8, color: FOG });

  p.drawText(d.kind === "path" ? "has participated in and completed the learning path" : "has participated in and completed the course", { x: L, y: H - 262, size: 13, font: sReg, color: SLATE });
  // Title, wrapped to two lines if needed
  const words = d.title.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  const tSize = 22;
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (hSemi.widthOfTextAtSize(t, tSize) > W - L - 60 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((ln, i) => p.drawText(ln, { x: L, y: H - 298 - i * 28, size: tSize, font: hSemi, color: WATER }));

  const date = d.issued.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const yMeta = 150;
  const meta = (label: string, value: string, x: number) => {
    spaced(label, { x, y: yMeta + 18, size: 7.5, font: hSemi, color: SLATE }, 1.4);
    p.drawText(value, { x, y: yMeta, size: 11.5, font: hReg, color: DEEP });
  };
  meta("DATE OF ISSUE", date, L);
  meta("CERTIFICATE ID", d.id, L + 170);
  if (d.minutes) meta("LEARNING TIME", `${Math.max(1, Math.round(d.minutes / 6) / 10)} hours`, L + 360);

  p.drawLine({ start: { x: L, y: 92 }, end: { x: L + 220, y: 92 }, thickness: 0.8, color: DEEP });
  p.drawText(d.issuer || "Anuj Matushankar Choudhary", { x: L, y: 76, size: 11, font: hSemi, color: DEEP });
  p.drawText("Founder & Director, Kayak Strategic Advisors Private Limited", { x: L, y: 62, size: 8.5, font: hReg, color: SLATE });

  p.drawText("Verify this certificate at", { x: W - 260, y: 76, size: 8, font: hReg, color: SLATE });
  p.drawText(d.verifyUrl.replace(/^https?:\/\//, ""), { x: W - 260, y: 62, size: 8.5, font: hSemi, color: GOLD });
  p.drawText("A certificate of participation records completion of the learning and its assessment. It is not a professional qualification.", { x: L, y: 36, size: 7, font: sItal, color: SLATE });

  return pdf.save();
}

/** Short, unambiguous certificate ID such as KSA-7Q4M-X2PD. */
export function certificateId(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map((x) => a[x % a.length]).join("");
  return `KSA-${s.slice(0, 4)}-${s.slice(4)}`;
}
