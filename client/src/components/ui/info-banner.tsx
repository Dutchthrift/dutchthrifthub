import { ReactNode } from "react";
import { AlertCircle, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerVariant = "info" | "warning" | "error" | "success" | "brand";

interface InfoBannerProps {
  variant?: BannerVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BannerVariant, { container: string; icon: ReactNode }> = {
  info: {
    container: "bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800",
    icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  },
  warning: {
    container: "bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />,
  },
  error: {
    container: "bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800",
    icon: <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
  },
  success: {
    container: "bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
    icon: <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />,
  },
  brand: {
    container: "bg-[var(--brand-orange-100)] text-[var(--brand-orange-700)] border border-[var(--brand-orange-600)]",
    icon: <Info className="h-4 w-4" style={{ color: "var(--brand-orange-600)" }} />,
  },
};

export function InfoBanner({ variant = "info", title, children, className }: InfoBannerProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn("rounded-lg border p-4", styles.container, className)}
      data-testid={`info-banner-${variant}`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
        <div className="flex-1">
          {title && (
            <h3 className="text-sm font-semibold mb-1" data-testid="banner-title">
              {title}
            </h3>
          )}
          <div className="text-sm" data-testid="banner-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
