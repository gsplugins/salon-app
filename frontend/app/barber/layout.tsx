import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BarberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-zinc-50/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">
              Lumière
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline">Staff workspace</span>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Link href="/staff/dashboard" className="rounded-lg px-2 py-1 hover:bg-zinc-100 hover:text-rose-800 dark:hover:bg-zinc-800 dark:hover:text-rose-200">
              Staff home
            </Link>
            <Link href="/staff/appointments" className="rounded-lg px-2 py-1 hover:bg-zinc-100 hover:text-rose-800 dark:hover:bg-zinc-800 dark:hover:text-rose-200">
              Appointments
            </Link>
            <Link href="/app" className="rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-rose-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-200">
              Account
            </Link>
            <Link href="/platform" className="rounded-lg px-2 py-1 text-rose-800 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/30">
              Site map
            </Link>
            <AuthHeaderProfile variant="compact" />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
