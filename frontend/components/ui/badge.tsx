"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "destructive" }) {
  const v =
    variant === "success"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
      : variant === "warning"
        ? "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        : variant === "destructive"
          ? "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-100"
          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100";
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", v, className)} {...props} />;
}
