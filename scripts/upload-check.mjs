// Uploads a local file through the Upload screen, extracts, and reports what the review shows.
import { chromium } from "playwright";
const [,, file, base = "http://localhost:3000", out] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "gz_user", value: "usr_nair", url: base }, { name: "gz_intro_done", value: "1", url: base }]);
await ctx.addInitScript(() => ["queue", "intake", "refill"].forEach((t) => localStorage.setItem(`gz_tour_${t}`, "1")));
const page = await ctx.newPage();
await page.goto(base + "/intake", { waitUntil: "networkidle" });
await page.locator('input[type=file]').setInputFiles(file);
await page.getByText(/ from Screenshot|Read with/).first().waitFor({ timeout: 90000 });
console.log("read:", await page.getByText(/Read with|Read the PDF|Read as plain/).first().innerText());
await page.getByRole("button", { name: /Extract and triage/ }).click();
await page.waitForURL(/\/refills\//, { timeout: 60000 });
await page.getByText("Where this refill stands").waitFor({ timeout: 60000 });
const body = await page.locator("body").innerText();
const review = body.includes("Review extraction and match patient");
console.log("auto-matched:", !review && body.includes("Linda Nguyen"));
if (review) {
  console.log("fields needing a person:", await page.locator("tr:has(input[type=checkbox]) td:first-child").allInnerTexts());
  console.log("matches chart:", await page.locator("tr:has-text('Matches chart') td:first-child").allInnerTexts());
}
console.log("timeline:", (body.match(/Matched to [^\n]+|Verified against the chart[^\n]+/g) || []).slice(0, 2));
if (out) await page.screenshot({ path: `${out}/upload-result.png`, fullPage: true });
await b.close();
