import Link from "next/link";

export const metadata = {
  title: "About | BarbarShop",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 text-slate-100 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-white">About BarbarShop</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">
        BarbarShop helps customers discover local barber shops, compare services, and book appointments quickly.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        This platform is focused on easy booking, clear service details, and smooth customer communication.
      </p>
      <div className="mt-8">
        <Link href="/" className="text-sm font-medium text-blue-300 hover:underline">
          Go back home
        </Link>
      </div>
    </main>
  );
}
