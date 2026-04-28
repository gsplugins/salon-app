"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import * as React from "react";

const variants = {
  default:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-rose-200",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  destructive:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-50",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; variant?: keyof typeof variants }
>(function Button({ className, variant = "default", asChild, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref as never} className={cn(variants[variant], className)} {...props} />;
});
