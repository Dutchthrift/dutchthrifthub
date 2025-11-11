import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("border-b bg-card", className)}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="page-header-title">
              {title}
            </h1>
            {badge && <div data-testid="page-header-badge">{badge}</div>}
          </div>
          {actions && (
            <div className="flex items-center gap-2" data-testid="page-header-actions">
              {actions}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground" data-testid="page-header-subtitle">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
