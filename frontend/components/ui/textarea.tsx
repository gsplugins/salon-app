"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[120px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-rose-500/20 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
          className
        )}
        {...props}
      />
    );
  }
);
