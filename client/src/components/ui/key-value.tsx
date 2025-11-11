import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KeyValueProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  className?: string;
  vertical?: boolean;
}

export function KeyValue({ label, value, valueClassName, className, vertical = false }: KeyValueProps) {
  if (vertical) {
    return (
      <div className={cn("space-y-1", className)} data-testid="key-value-vertical">
        <dt className="text-sm text-muted-foreground" data-testid="key-value-label">
          {label}
        </dt>
        <dd className={cn("text-sm font-medium", valueClassName)} data-testid="key-value-value">
          {value}
        </dd>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between py-2", className)} data-testid="key-value">
      <dt className="text-sm text-muted-foreground" data-testid="key-value-label">
        {label}
      </dt>
      <dd className={cn("text-sm font-medium", valueClassName)} data-testid="key-value-value">
        {value}
      </dd>
    </div>
  );
}
