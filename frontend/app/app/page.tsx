import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthPortal } from "./auth-portal";

export const metadata = {
  title: "Account & staff — Lumière Salon",
  description:
    "Sign in with mobile and password, SMS OTP reset, JWT access and refresh tokens.",
};

export default function StaffAppPage() {
  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-rose-100/80 bg-[#faf8f6]/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-800/80 dark:text-rose-200/80">
              Salon account
            </p>
            <h1 className="font-semibold tracking-tight text-zinc-900 dark:text-white">
              Lumière — staff &amp; API demo
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 text-sm font-medium">
            <Link href="/owner/dashboard" className="hidden text-zinc-600 hover:text-rose-800 sm:inline dark:text-zinc-400">
              Owner
            </Link>
            <Link href="/platform" className="text-rose-800 hover:underline dark:text-rose-200">
              Site map
            </Link>
            <Link href="/" className="text-zinc-600 hover:text-rose-800 dark:text-zinc-400">
              Home
            </Link>
            <AuthHeaderProfile variant="compact" />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <AuthPortal />
      </main>
    </div>
  );
}
