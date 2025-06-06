"use client"; 

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.20))] text-center p-4">
      <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2 font-headline">Oops! Something went wrong.</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        We encountered an unexpected issue. Please try again, or contact support if the problem persists.
      </p>
      <Button
        onClick={() => reset()}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Try again
      </Button>
      {error?.digest && (
        <p className="text-xs text-muted-foreground mt-4">Error Digest: {error.digest}</p>
      )}
    </div>
  );
}
