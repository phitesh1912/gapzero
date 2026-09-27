import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <Card>
      <EmptyState title="Refill request not found">
        It may have been removed by a demo reset. <Link href="/queue" className="text-accent hover:underline">Back to the queue</Link>
      </EmptyState>
    </Card>
  );
}
