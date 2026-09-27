"use client";

// Turns an uploaded fax (text, PDF or image) into text, entirely in the browser: the image never
// leaves the device; only the recognized text is sent on for extraction.

export type ReadMethod = "text" | "pdf-text" | "ocr";
export type ReadResult = { text: string; method: ReadMethod; pages: number; confidence: number | null };
export type Progress = (label: string, fraction?: number) => void;

const MAX_PAGES = 4;
const MIN_TEXT_PER_PAGE = 120; // a sparser text layer (just a header or stamp) = a scanned PDF, so OCR it

export async function readFax(file: File, onProgress: Progress): Promise<ReadResult> {
  const name = file.name.toLowerCase();
  if (file.type === "text/plain" || name.endsWith(".txt")) {
    return { text: await file.text(), method: "text", pages: 1, confidence: null };
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return readPdf(file, onProgress);
  if (file.type.startsWith("image/")) {
    const { text, confidence } = await ocr([file], onProgress);
    return { text, method: "ocr", pages: 1, confidence };
  }
  throw new Error("Unsupported file. Upload a PDF, an image (PNG or JPG) or a .txt file.");
}

async function readPdf(file: File, onProgress: Progress): Promise<ReadResult> {
  onProgress("Opening PDF");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(doc.numPages, MAX_PAGES);

  // 1) A digital PDF carries its own text: read it directly, no OCR needed.
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : "");
    }
    text += "\n";
  }
  if (text.replace(/\s/g, "").length >= MIN_TEXT_PER_PAGE * pages) return { text: text.trim(), method: "pdf-text", pages, confidence: null };

  // 2) A scanned PDF is just images: render each page and OCR it.
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= pages; i++) {
    onProgress(`Rendering page ${i} of ${pages}`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  const result = await ocr(canvases, onProgress);
  return { ...result, method: "ocr", pages };
}

async function ocr(images: (File | HTMLCanvasElement)[], onProgress: Progress) {
  onProgress("Loading text recognition", 0);
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(images.length > 1 ? `Reading page ${page + 1} of ${images.length}` : "Reading text", (page + m.progress) / images.length);
      else if (m.status.startsWith("loading")) onProgress("Loading text recognition", m.progress * 0.3);
    },
  });
  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (; page < images.length; page++) {
      const { data } = await worker.recognize(images[page]);
      texts.push(data.text);
      confidences.push(data.confidence);
    }
    return { text: texts.join("\n").trim(), confidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null };
  } finally {
    await worker.terminate();
  }
}

// ------------------------------------------------------------------------------------------------
// For AI vision: shrink the document to at most two JPEG pages of ≤1600 px so the upload stays small.

export type VisionImage = { mediaType: "image/jpeg"; base64: string };
const MAX_SIDE = 1600;

export async function toVisionImages(file: File): Promise<VisionImage[]> {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out: VisionImage[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, MAX_SIDE / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      out.push(canvasToJpeg(canvas));
    }
    return out;
  }
  if (!file.type.startsWith("image/")) throw new Error("AI vision reads images and PDFs.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return [canvasToJpeg(canvas)];
}

function canvasToJpeg(canvas: HTMLCanvasElement): VisionImage {
  return { mediaType: "image/jpeg", base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] };
}
