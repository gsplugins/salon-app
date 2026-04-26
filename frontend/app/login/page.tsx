import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in — BarbarShop",
};

/** Canonical auth UI lives under `/app/auth`; this path is a stable alias. */
export default function LoginAliasPage() {
  redirect("/app/auth?tab=login");
}
