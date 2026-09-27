import { chromium } from "playwright";
const [,, base, outDir, name, path, user = "usr_nair", tourStep = "0"] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "gz_user", value: user, url: base }, { name: "gz_intro_done", value: "1", url: base }]);
const page = await ctx.newPage();
await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
for (let i = 0; i < Number(tourStep); i++) { await page.locator(".driver-popover-next-btn").click(); await page.waitForTimeout(700); }
await page.screenshot({ path: `${outDir}/${name}.png` });
await browser.close();
console.log("saved", name);
