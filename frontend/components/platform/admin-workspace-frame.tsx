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
      <div className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--surface)] via-[color:var(--surface-elevated)] to-[color:color-mix(in_srgb,var(--brand-glow)_22%,var(--background))] p-6 shadow-sm md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-200/45 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-primary)]">
                {eyebrow}
              </p>
              {badge ? (
                <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]">
                  {badge}
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)] md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--paragraph)]">{subtitle}</p>
          </div>
          {actions ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
