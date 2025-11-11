import { cn } from "@/lib/utils";

export type StatusVariant =
  | "return_in_progress"
  | "paid"
  | "fulfilled"
  | "received_control"
  | "approved_refund"
  | "missing_package"
  | "waiting_customer"
  | "reship"
  | "closed_not_received"
  | "default";

interface StatusChipProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  return_in_progress: "bg-[var(--brand-orange-100)] text-[var(--brand-orange-700)] border-[var(--brand-orange-600)]",
  paid: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
  fulfilled: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
  received_control: "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  approved_refund: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  missing_package: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  waiting_customer: "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  reship: "bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  closed_not_received: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
};

export function StatusChip({ variant, label, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
        variantStyles[variant],
        className
      )}
      data-testid={`status-chip-${variant}`}
    >
      {label}
    </span>
  );
}
