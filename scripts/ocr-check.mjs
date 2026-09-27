// Loads each sample fax through the Upload fax screen and reports how it was read.
import { chromium } from "playwright";
const [,, base = "http://localhost:3000", out] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "gz_user", value: "usr_nair", url: base }, { name: "gz_intro_done", value: "1", url: base }]);
await ctx.addInitScript(() => ["queue", "intake", "refill"].forEach((t) => localStorage.setItem(`gz_tour_${t}`, "1")));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(base + "/intake", { waitUntil: "networkidle" });
const SAMPLES = { "Scanned image": "fax-messy-scan.png", "Digital PDF": "fax-clean.pdf", "Scanned PDF": "fax-missing-info-scan.pdf" };
for (const [kind, file] of Object.entries(SAMPLES)) {
  const t0 = Date.now();
  await page.getByRole("button", { name: new RegExp(kind) }).click();
  const label = page.getByText(new RegExp(` from ${file.replace(".", "\\.")}`));
  await label.waitFor({ timeout: 90000 });
  const how = await label.innerText();
  const text = await page.locator('[data-tour="fax-text"]').inputValue();
  console.log(`${kind}: ${((Date.now() - t0) / 1000).toFixed(1)}s | ${how}`);
  console.log(`   ${text.length} chars:`, JSON.stringify(text.slice(0, 260)));
  if (out && kind === "Scanned image") await page.screenshot({ path: `${out}/intake-ocr.png`, fullPage: true });
}
await b.close();
