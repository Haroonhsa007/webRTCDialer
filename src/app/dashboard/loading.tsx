
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-6">
      {/* Skeleton for potential Caller ID input card */}
      <div className="w-full max-w-md">
        <Skeleton className="h-10 w-1/2 mx-auto mb-2" /> 
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      
      <CardSkeleton height="120px" />
      
      <div className="flex items-center justify-center space-x-3 p-4 bg-card rounded-xl shadow-xl mt-4 w-full max-w-xs">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-16 w-16 rounded-full bg-destructive/50" />
      </div>
      
      <DialpadSkeleton />
      
      <CardSkeleton height="280px" />
    </div>
  );
}

function CardSkeleton({ height = "150px" }: { height?: string }) {
  return (
    <div className="w-full max-w-lg bg-card rounded-xl shadow-lg p-6 space-y-3">
      <Skeleton className="h-6 w-1/3 mx-auto mb-4" />
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-5 w-1/2 mx-auto" />
      <Skeleton style={{ height }} className="w-full mt-2" />
    </div>
  );
}

function DialpadSkeleton() {
  return (
    <div className="w-full max-w-xs mx-auto p-4 bg-card rounded-xl shadow-2xl space-y-3">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-2">
        {[...Array(9)].map((_, i) => (
          <Skeleton key={`dialkey-skel-${i}`} className="h-16 rounded-lg" />
        ))}
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg bg-accent/50" />
    </div>
  );
}
