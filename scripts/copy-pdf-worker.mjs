// Copies pdf.js's worker into public/ so the browser can load it at /pdf.worker.min.mjs.
import { copyFileSync, existsSync } from "node:fs";
const src = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (existsSync(src)) copyFileSync(src, "public/pdf.worker.min.mjs");
