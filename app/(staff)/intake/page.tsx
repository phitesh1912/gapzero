import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { activeProvider } from "@/lib/ai/client";
import { FaxIntake } from "@/components/intake/FaxIntake";

export const metadata: Metadata = { title: "Upload fax" };

export default async function IntakePage() {
  const user = await getCurrentUser();
  if (!can(user.role, "CONFIRM_EXTRACTION")) redirect("/queue");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Upload a refill fax</h1>
        <p className="mt-1 text-sm text-muted">
          AI reads the fax and extracts the fields with a confidence score. Anything it isn&apos;t sure about waits for you to confirm before the request moves on.
        </p>
      </div>
      <FaxIntake provider={activeProvider()} />
    </div>
  );
}
