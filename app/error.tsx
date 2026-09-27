"use client";

import { buttonClass } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbHint = /database|prisma|DATABASE_URL|connect|demo users/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        {dbHint
          ? "Couldn't reach the database. Check DATABASE_URL in .env, then run `npm run db:seed`."
          : "The page couldn't load. Your data is safe; try again."}
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Ref {error.digest}</p>}
      <button className={`${buttonClass("primary")} mt-6`} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
