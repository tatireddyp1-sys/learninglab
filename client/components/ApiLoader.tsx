import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ApiLoaderProps {
  /** Full viewport overlay */
  fullPage?: boolean;
  className?: string;
  label?: string;
}

export function ApiLoader({ fullPage, className, label = "Loading" }: ApiLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullPage && "min-h-[40vh] w-full",
        className
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
