"use client";

export function AdminWorkspaceFrame(props: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { eyebrow = "Super admin", title, subtitle, badge, actions, children } = props;
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-300 bg-gradient-to-br from-white via-zinc-50 to-rose-50/50 p-6 shadow-sm md:p-8 dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-rose-950/30">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-200/45 blur-3xl dark:bg-rose-500/15" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700 dark:text-rose-200">
                {eyebrow}
              </p>
              {badge ? (
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-200">
                  {badge}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl dark:text-white">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{subtitle}</p>
          </div>
          {actions ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
