import { Skeleton } from "@/components/ui/skeleton";

export function EmailListSkeleton() {
  return (
    <div className="space-y-0" data-testid="email-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
