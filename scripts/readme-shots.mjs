// Captures README screenshots from a running GapZero (walkthrough popups suppressed).
import { chromium } from "playwright";
const [,, base, refillId] = process.argv;
const b = await chromium.launch();
async function shot(name, path, { user, intro = true, height = 900 } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height }, deviceScaleFactor: 1 });
  const cookies = [];
  if (user) cookies.push({ name: "gz_user", value: user, url: base });
  if (intro) cookies.push({ name: "gz_intro_done", value: "1", url: base });
  if (cookies.length) await ctx.addCookies(cookies);
  await ctx.addInitScript(() => ["queue", "intake", "refill", "ops", "protocol"].forEach((t) => localStorage.setItem(`gz_tour_${t}`, "1")));
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
  await ctx.close();
  console.log("saved", name);
}
await shot("intro", "/?intro=1", { intro: false });
await shot("queue", "/queue", { user: "usr_nair", height: 1000 });
await shot("refill-packet", `/refills/${refillId}`, { user: "usr_chen", height: 1000 });
await shot("ops", "/ops", { user: "usr_ortiz", height: 1000 });
await b.close();
