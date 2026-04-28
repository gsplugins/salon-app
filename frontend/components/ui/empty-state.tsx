import type { LucideIcon } from "lucide-react";

export function EmptyState(props: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
        <Icon className="h-8 w-8 opacity-90" strokeWidth={1.5} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-800 dark:text-white">{props.title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-800 dark:text-zinc-400">{props.description}</p>
      {props.action ? <div className="mt-6">{props.action}</div> : null}
    </div>
  );
}
