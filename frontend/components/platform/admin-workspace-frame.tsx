"use client";

export function AdminWorkspaceFrame(props: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { eyebrow = "Super admin", title, subtitle, children } = props;
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white via-rose-50/40 to-zinc-100 p-8 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-rose-950/20 dark:to-zinc-950">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl dark:bg-rose-500/10" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-800 dark:text-rose-200">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
