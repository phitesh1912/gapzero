import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading refill">
      <Skeleton className="h-4 w-16" />
      <Card className="space-y-3 p-5">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-12 w-full" />
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
