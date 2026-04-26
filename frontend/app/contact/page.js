import Link from "next/link";

export const metadata = {
  title: "Contact | Prime Barbershop",
};

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-slate-100 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Contact</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        Need help with bookings or shop onboarding? Reach out and our team will assist you.
      </p>
      <div className="mt-6 space-y-2 text-sm text-slate-300">
        <p>Email: support@primebarbershop.example</p>
        <p>Phone: +1 (503) 555-0128</p>
      </div>
      <div className="mt-8">
        <Link href="/" className="text-sm font-medium text-blue-300 hover:underline">
          Go back home
        </Link>
      </div>
    </main>
  );
}
