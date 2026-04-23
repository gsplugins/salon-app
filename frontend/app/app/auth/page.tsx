import Link from "next/link";
import { AuthPortal } from "../auth-portal";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const ALLOWED_TABS = new Set(["login", "register", "forgot", "reset"]);

export const metadata = {
  title: "Login or register — Prime Barbershop",
};

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = sp.tab;
  const initialTab = tab && ALLOWED_TABS.has(tab) ? (tab as "login" | "register" | "forgot" | "reset") : "login";

  return (
    <div className="min-h-[100dvh] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-4">
          <Link href="/app" className="text-sm font-medium text-blue-300 hover:underline">
            Back to portal hub
          </Link>
        </div>
        <AuthPortal initialTab={initialTab} />
      </main>
    </div>
  );
}
