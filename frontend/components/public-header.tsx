import Link from "next/link";
import { AuthHeaderProfile } from "@/components/auth-header-profile";

type Props = {
  /** Show anchor links for marketing home sections (#services, #visit, #how-heading). */
  showMarketingNav?: boolean;
};

export function PublicHeader({ showMarketingNav }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:color-mix(in srgb, var(--background) 92%, transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-[color:var(--foreground)]">
            BarbarShop
          </Link>
          <nav
            className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium md:flex"
            aria-label="Primary"
          >
            <Link
              href="/shops"
              className="text-[color:var(--foreground)]/80 transition hover:text-[color:var(--brand-primary)]"
            >
              Find nearby shops
            </Link>
            {showMarketingNav ? (
              <>
                <a
                  href="#how-heading"
                  className="text-[color:var(--caption)] transition hover:text-[color:var(--brand-primary)]"
                >
                  How it works
                </a>
                <a
                  href="#services"
                  className="text-[color:var(--caption)] transition hover:text-[color:var(--brand-primary)]"
                >
                  Services
                </a>
                <a
                  href="#visit"
                  className="text-[color:var(--caption)] transition hover:text-[color:var(--brand-primary)]"
                >
                  Local guide
                </a>
              </>
            ) : null}
            <Link
              href="/queue/1"
              className="text-[color:var(--caption)] transition hover:text-[color:var(--brand-primary)]"
            >
              Live queue
            </Link>
            <Link
              href="/app"
              className="font-medium text-[color:var(--brand-primary)] transition hover:text-[color:var(--brand-primary-hover)]"
            >
              List your shop
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-2 sm:hidden" aria-label="Mobile quick links">
            <Link href="/shops" className="text-sm font-medium text-[color:var(--brand-primary)]">
              Barbershops
            </Link>
          </nav>
          <AuthHeaderProfile />
        </div>
      </div>
    </header>
  );
}
