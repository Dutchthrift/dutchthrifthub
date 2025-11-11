import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  image?: string;
  imageAlt?: string;
  imageFallback?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ItemRow({
  image,
  imageAlt,
  imageFallback,
  title,
  subtitle,
  meta,
  actions,
  className,
}: ItemRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)} data-testid="item-row">
      {(image || imageFallback) && (
        <div className="flex-shrink-0" data-testid="item-row-image">
          {image ? (
            <img
              src={image}
              alt={imageAlt || title}
              className="h-12 w-12 rounded-md border object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
              {imageFallback}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" data-testid="item-row-title">
              {title}
            </p>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate" data-testid="item-row-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {meta && (
            <div className="flex-shrink-0 text-right" data-testid="item-row-meta">
              {meta}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex-shrink-0" data-testid="item-row-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
