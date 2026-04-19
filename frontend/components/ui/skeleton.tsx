import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80", className)}
      aria-hidden
    />
  );
}
