import { redirect } from "next/navigation";

export const metadata = {
  title: "Create account — Prime Barbershop",
};

/** Canonical auth UI lives under `/app/auth`; this path is a stable alias. */
export default function RegisterAliasPage() {
  redirect("/app/auth?tab=register");
}
