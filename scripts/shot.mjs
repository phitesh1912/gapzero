import { chromium } from "playwright";
const [,, base, outDir, ...specs] = process.argv;
const browser = await chromium.launch();
for (const spec of specs) {
  const [user, path, name, width = "1440"] = spec.split("|");
  const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1 });
  await ctx.addCookies([{ name: "gz_user", value: user, url: base }]);
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  await ctx.close();
  console.log("saved", name);
}
await browser.close();
