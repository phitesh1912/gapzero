// Renders a synthetic, handwritten refill request photographed at an angle: the kind of document
// on-device OCR struggles with. Invented patient (Aisha Patel, from the demo seed) and pharmacy.
// Run: node scripts/make-handwritten-sample.mjs
import { chromium } from "playwright";

const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;width:1400px;height:1050px;background:radial-gradient(ellipse at 30% 20%,#8a6a4a,#5b4330 70%);display:grid;place-items:center;overflow:hidden}
  .photo{transform:perspective(1600px) rotateX(9deg) rotateY(-7deg) rotateZ(-3deg);box-shadow:30px 40px 60px rgba(0,0,0,.45)}
  .sheet{width:760px;height:960px;background:#fbfaf5;padding:46px 54px;box-sizing:border-box;position:relative;font-family:Inter,sans-serif;color:#222}
  .sheet:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 80% 90%,rgba(0,0,0,.18),transparent 55%),linear-gradient(115deg,rgba(255,255,255,.35),transparent 40%)}
  h1{font-size:22px;margin:0;letter-spacing:.04em} .sub{font-size:13px;color:#555;margin-top:4px}
  .title{margin:26px 0 18px;font-weight:600;font-size:17px;border-top:2px solid #222;border-bottom:2px solid #222;padding:6px 0}
  .row{display:flex;align-items:flex-end;gap:10px;margin:20px 0;font-size:15px}
  .row b{white-space:nowrap;font-weight:600}
  .line{flex:1;border-bottom:1px solid #999;min-height:34px;font:600 30px/1 Caveat,cursive;color:#1f3a8a;padding-left:6px}
  .note{margin-top:26px;font:500 28px/1.25 Caveat,cursive;color:#1f3a8a}
  .stamp{position:absolute;right:60px;bottom:120px;transform:rotate(-12deg);border:3px solid rgba(190,30,30,.7);color:rgba(190,30,30,.75);font-weight:600;padding:6px 12px;letter-spacing:.08em}
  .foot{position:absolute;bottom:34px;left:54px;font-size:11px;color:#777}
</style></head><body><div class="photo"><div class="sheet">
  <h1>RIVERSIDE DRUG</h1><div class="sub">1402 Riverside Ave · Tel (555) 010-2201 · Fax (555) 010-2200</div>
  <div class="title">REFILL AUTHORIZATION REQUEST</div>
  <div class="row"><b>Patient</b><div class="line">Aisha Patel</div></div>
  <div class="row"><b>Date of birth</b><div class="line">11/21/1972</div></div>
  <div class="row"><b>Medication &amp; strength</b><div class="line">Levothyroxine 75 mcg</div></div>
  <div class="row"><b>Qty</b><div class="line">90</div><b>Days</b><div class="line">90</div></div>
  <div class="row"><b>Directions</b><div class="line">1 tab every morning, empty stomach</div></div>
  <div class="row"><b>Prescriber</b><div class="line">Dr. Rao</div></div>
  <div class="note">No refills left - pt says only 4 tabs left.<br>Please send new Rx today. Thx! - M.K. (RPh)</div>
  <div class="stamp">URGENT</div>
  <div class="foot">SYNTHETIC DEMO DOCUMENT · NOT A REAL PATIENT</div>
</div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "public/samples/refill-handwritten-photo.jpg", type: "jpeg", quality: 82 });
await browser.close();
console.log("handwritten sample written");
