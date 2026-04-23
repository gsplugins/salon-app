export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-card neon-border w-full max-w-sm rounded-3xl p-8 text-center fade-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/10 pulse-ring">
          <div className="h-8 w-8 rounded-full border-2 border-blue-200/50 border-t-blue-400 spin-slow" />
        </div>
        <p className="mt-5 text-sm font-medium text-blue-100">Loading your barbershop experience...</p>
      </div>
    </div>
  );
}
