// A clean, synthetic pharmacy refill request for demo patient Rosa Delgado (matches her seeded chart).
// Run: node scripts/make-test-document.mjs "<output dir>"
import { chromium } from "playwright";

const out = process.argv[2] ?? "docs/test-documents";
const DAY = 86_400_000;
const fmt = (d) => d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
const today = new Date();
const lastFill = new Date(today.getTime() - 24 * DAY); // 30-day supply, 6 days left

const html = `<!doctype html><html><head><style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
  .page{width:816px;min-height:1056px;padding:56px 64px;box-sizing:border-box}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:12px}
  h1{font-size:24px;margin:0;letter-spacing:.03em} .small{font-size:12px;color:#333;line-height:1.5}
  h2{font-size:18px;margin:26px 0 6px;letter-spacing:.06em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 40px;margin-top:14px;font-size:15px}
  .full{grid-column:1 / -1}
  b{display:inline-block;min-width:130px}
  .note{margin-top:26px;padding:12px 14px;border:1px solid #999;font-size:15px}
  .sign{margin-top:36px;font-size:14px;line-height:2}
  .foot{margin-top:40px;font-size:11px;color:#555;border-top:1px solid #bbb;padding-top:8px}
</style></head><body><div class="page">
  <div class="top">
    <div><h1>MAIN STREET PHARMACY</h1><div class="small">220 Main St · Phone (555) 010-3301 · Fax (555) 010-3300<br>NCPDP 0000001</div></div>
    <div class="small" style="text-align:right">Date: ${fmt(today)}<br>Page 1 of 1</div>
  </div>
  <h2>REFILL AUTHORIZATION REQUEST</h2>
  <div class="small">To: Dr. Asha Rao · Please review and fax back.</div>
  <div class="grid">
    <div><b>Patient:</b> Rosa Delgado</div><div><b>DOB:</b> 04/12/1961</div>
    <div><b>Patient phone:</b> 555-0100</div><div><b>Prescriber:</b> Dr. Asha Rao</div>
    <div class="full"><b>Medication:</b> Metformin 1000 mg tablet</div>
    <div class="full"><b>Sig:</b> Take 1 tablet by mouth twice daily with meals</div>
    <div><b>Quantity:</b> 60</div><div><b>Days supply:</b> 30</div>
    <div><b>Refills remaining:</b> 0</div><div><b>Last filled:</b> ${fmt(lastFill)}</div>
  </div>
  <div class="note">Patient has about 6 days of medication left. No refills remain on file. Please authorize a new prescription.</div>
  <div class="sign">☐ Approved &nbsp;&nbsp; ☐ Denied &nbsp;&nbsp; Quantity authorized: ________<br>Prescriber signature: ______________________ &nbsp; Date: __________</div>
  <div class="foot">SYNTHETIC DEMO DOCUMENT · NOT A REAL PATIENT · For testing GapZero only</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 1.5 });
await page.setContent(html);
await page.pdf({ path: `${out}/refill-request-rosa-delgado.pdf`, width: "816px", height: "1056px", printBackground: true });
await page.screenshot({ path: `${out}/refill-request-rosa-delgado.png`, fullPage: true });
await browser.close();
console.log("written to", out);
