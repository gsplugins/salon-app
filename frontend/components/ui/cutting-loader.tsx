import { Scissors } from "lucide-react";

export function CuttingLoader(props: { label?: string; compact?: boolean }) {
  const { label = "Loading...", compact = false } = props;
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div
        className={`relative overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] ${
          compact ? "h-14 w-14" : "h-16 w-16"
        }`}
        aria-hidden
      >
        <div className="cutting-track absolute inset-y-1/2 left-2 right-2 -translate-y-1/2 rounded-full" />
        <Scissors
          className={`cutting-scissor absolute top-1/2 -translate-y-1/2 text-[color:var(--brand-primary)] ${
            compact ? "h-5 w-5" : "h-6 w-6"
          }`}
        />
      </div>
      <p className="mt-3 text-sm font-medium text-[color:var(--paragraph)]">{label}</p>
    </div>
  );
}
