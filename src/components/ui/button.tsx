import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:opacity-95 disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/15 hover:bg-primary/90 dark:bg-primary dark:shadow-none dark:ring-0",
        brand:
          "border-transparent bg-gradient-brand text-[var(--brand-foreground)] shadow-glow hover:opacity-95 focus-visible:ring-[color-mix(in_oklch,var(--brand-ring)_25%,transparent)]",
        brandSoft:
          "button-brand-soft focus-visible:ring-[color-mix(in_oklch,var(--brand-ring)_25%,transparent)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        dangerSoft: "button-danger-soft shadow-sm focus-visible:ring-destructive/25",
        outline:
          "border border-control-border bg-control text-control-foreground shadow-sm hover:bg-control-hover hover:text-control-foreground active:bg-control-active",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        warning:
          "border border-amber-400/25 bg-amber-500/12 text-amber-800 shadow-sm hover:bg-amber-500/20 dark:text-amber-200",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
