import { timingSafeEqual } from "node:crypto";
import { processRetries } from "@/lib/refill/workflow";

// Retry worker for Vercel Cron (GET with `Authorization: Bearer $CRON_SECRET`).
// Honors backoff; the Ops button uses runRetriesAction instead, which retries immediately.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = !!secret && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await processRetries();
  return Response.json({ attempted: result.attempted, succeeded: result.succeeded });
}
