import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading queue">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-16 w-full" />
      <Card className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Card>
    </div>
  );
}
