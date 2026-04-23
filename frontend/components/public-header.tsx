import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  /** Show anchor links for marketing home sections (#services, #visit, #how-heading). */
  showMarketingNav?: boolean;
};

export function PublicHeader({ showMarketingNav }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0a1220]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-slate-100">
            Prime Barbershop
          </Link>
          <nav
            className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium md:flex"
            aria-label="Primary"
          >
            <Link
              href="/shops"
              className="text-slate-200 transition hover:text-blue-300"
            >
              Find nearby shops
            </Link>
            {showMarketingNav ? (
              <>
                <a
                  href="#how-heading"
                  className="text-slate-400 transition hover:text-blue-300"
                >
                  How it works
                </a>
                <a
                  href="#services"
                  className="text-slate-400 transition hover:text-blue-300"
                >
                  Services
                </a>
                <a
                  href="#visit"
                  className="text-slate-400 transition hover:text-blue-300"
                >
                  Local guide
                </a>
              </>
            ) : null}
            <Link
              href="/queue/1"
              className="text-slate-400 transition hover:text-blue-300"
            >
              Live queue
            </Link>
            <Link
              href="/app"
              className="font-medium text-blue-300 transition hover:text-blue-200"
            >
              List your shop
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-2 sm:hidden" aria-label="Mobile quick links">
            <Link href="/shops" className="text-sm font-medium text-blue-300">
              Barbershops
            </Link>
          </nav>
          <AuthHeaderProfile />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
