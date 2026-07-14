import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageHeaderBreadcrumb = {
  label: string;
  to?: string;
};

export type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backTo?: { to: string; label: string };
  breadcrumbs?: PageHeaderBreadcrumb[];
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const hasMetaRow = backTo || (breadcrumbs && breadcrumbs.length > 0);

  return (
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {hasMetaRow ? (
          <div className="flex flex-wrap items-center gap-2">
            {backTo ? (
              <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2 text-muted-foreground" asChild>
                <Link to={backTo.to}>
                  <ChevronLeft className="size-4" />
                  {backTo.label}
                </Link>
              </Button>
            ) : null}
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <Breadcrumb className={backTo ? "hidden sm:block" : undefined}>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                      <span key={`${crumb.label}-${index}`} className="contents">
                        <BreadcrumbItem>
                          {isLast || !crumb.to ? (
                            <BreadcrumbPage className="max-w-[12rem] truncate sm:max-w-xs">
                              {crumb.label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.to} className="max-w-[10rem] truncate sm:max-w-xs">
                                {crumb.label}
                              </Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                        {!isLast ? <BreadcrumbSeparator /> : null}
                      </span>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
