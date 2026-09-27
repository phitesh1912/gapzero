// Renders the text sample faxes as realistic "scanned" images and PDFs for the Upload fax demo.
// Run: node scripts/make-sample-faxes.mjs
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const page = (text, { tilt = 0, noise = 0.35, blur = 0.35, digital = false } = {}) => `<!doctype html><html><head><style>
  html,body{margin:0;background:#fff}
  .sheet{width:850px;height:1100px;position:relative;overflow:hidden;background:#f4f3ef}
  .paper{position:absolute;inset:40px 48px;transform:rotate(${tilt}deg);transform-origin:top left;
         font:600 19px/1.55 "Courier New",Courier,monospace;color:#1c1c1c;white-space:pre;${digital ? "" : `filter:blur(${blur}px) contrast(1.25)`}}
  .grain{position:absolute;inset:0;opacity:${noise};mix-blend-mode:multiply;
         background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 1.4 -0.35'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")}
  .lines{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.035) 3px 4px)}
  .hdr{position:absolute;top:10px;left:48px;right:48px;font:12px monospace;color:#555;display:flex;justify-content:space-between}
</style></head><body><div class="sheet">
  <div class="hdr"><span>FROM: PHARMACY FAX</span><span>SYNTHETIC DEMO DOCUMENT</span><span>P.1/1</span></div>
  <div class="paper">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
  ${digital ? "" : '<div class="lines"></div><div class="grain"></div>'}
</div></body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 850, height: 1100 }, deviceScaleFactor: 1.5 });
const today = new Date().toLocaleDateString("en-US");
const load = (f) => readFileSync(`public/samples/${f}`, "utf8").replace("[today]", today);

// 1) Messy fax as a scanned image (OCR path)
await p.setContent(page(load("fax-messy.txt"), { tilt: 0.6, noise: 0.45, blur: 0.45 }));
await p.screenshot({ path: "public/samples/fax-messy-scan.png" });

// 2) Clean fax as a digital PDF with a text layer (direct text path)
await p.setContent(page(load("fax-clean.txt"), { digital: true }));
await p.pdf({ path: "public/samples/fax-clean.pdf", width: "850px", height: "1100px", printBackground: true });

// 3) Missing-info fax as a scanned PDF: an image only, no text layer (PDF -> OCR path)
await p.setContent(page(load("fax-missing-info.txt"), { tilt: -0.5, noise: 0.4, blur: 0.4 }));
const png = await p.screenshot({ type: "png" });
await p.setContent(`<html><body style="margin:0"><img style="width:850px;height:1100px" src="data:image/png;base64,${png.toString("base64")}"></body></html>`);
await p.pdf({ path: "public/samples/fax-missing-info-scan.pdf", width: "850px", height: "1100px", printBackground: true });

await browser.close();
console.log("sample faxes written");
