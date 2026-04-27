import Link from "next/link";
import { AuthPortal } from "../auth-portal";
import { PublicHeader } from "@/components/public-header";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const ALLOWED_TABS = new Set(["login", "register", "forgot", "reset"]);

export const metadata = {
  title: "Login or register — BarbarShop",
};

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = sp.tab;
  const initialTab = tab && ALLOWED_TABS.has(tab) ? (tab as "login" | "register" | "forgot" | "reset") : "login";

  return (
    <div className="min-h-[100dvh] bg-[#0d0d0d] text-white">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4">
          <Link href="/app" className="text-sm font-medium text-[#c6a43f] hover:underline">
            Back to portal hub
          </Link>
        </div>
        <AuthPortal initialTab={initialTab} />
      </main>
    </div>
  );
}
