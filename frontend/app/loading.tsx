import { CuttingLoader } from "@/components/ui/cutting-loader";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-6">
      <div className="glass-card neon-border w-full max-w-sm rounded-3xl p-8 text-center fade-up">
        <CuttingLoader label="Preparing your barbershop experience..." />
      </div>
    </div>
  );
}
