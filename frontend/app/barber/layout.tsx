import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BarberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-200">
              Lumière
            </Link>
            <span className="hidden text-xs text-zinc-400 sm:inline">Barber</span>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
            <Link href="/barber/schedule" className="hover:text-rose-800 dark:hover:text-rose-200">
              Today
            </Link>
            <Link href="/barber/history" className="hover:text-rose-800 dark:hover:text-rose-200">
              History
            </Link>
            <Link href="/app" className="text-zinc-600 hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-200">
              Calendar
            </Link>
            <Link href="/platform" className="text-rose-800 hover:underline dark:text-rose-200">
              Site map
            </Link>
            <AuthHeaderProfile variant="compact" />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">{children}</div>
    </div>
  );
}
