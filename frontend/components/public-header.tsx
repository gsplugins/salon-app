import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  /** Show anchor links for marketing home sections (#services, #visit, #how-heading). */
  showMarketingNav?: boolean;
};

export function PublicHeader({ showMarketingNav }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-[#faf8f6]/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link href="/" className="shrink-0 font-semibold tracking-tight text-zinc-900 dark:text-white">
            Lumière Salon
          </Link>
          <nav
            className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium md:flex"
            aria-label="Primary"
          >
            <Link
              href="/shops"
              className="text-zinc-700 transition hover:text-rose-800 dark:text-zinc-300 dark:hover:text-rose-200"
            >
              Browse shops
            </Link>
            {showMarketingNav ? (
              <>
                <a
                  href="#how-heading"
                  className="text-zinc-500 transition hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-200"
                >
                  How it works
                </a>
                <a
                  href="#services"
                  className="text-zinc-500 transition hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-200"
                >
                  Services
                </a>
                <a
                  href="#visit"
                  className="text-zinc-500 transition hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-200"
                >
                  Visit
                </a>
              </>
            ) : null}
            <Link
              href="/platform"
              className="text-zinc-500 transition hover:text-rose-800 dark:text-zinc-400 dark:hover:text-rose-200"
            >
              Site map
            </Link>
            <Link
              href="/app"
              className="font-medium text-rose-800 transition hover:underline dark:text-rose-200"
            >
              For salons
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-2 sm:hidden" aria-label="Mobile quick links">
            <Link href="/shops" className="text-sm font-medium text-rose-800 dark:text-rose-200">
              Shops
            </Link>
          </nav>
          <AuthHeaderProfile />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
