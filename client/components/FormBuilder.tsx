import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormBuilderProps {
  /** Optional section heading for grouped fields */
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Consistent spacing wrapper for forms. Pair with react-hook-form + Zod on each page.
 */
export function FormBuilder({ title, children, className }: FormBuilderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {title ? <h2 className="text-lg font-medium">{title}</h2> : null}
      {children}
    </div>
  );
}
