type LoadingProps = {
  message?: string;
  fullPage?: boolean;
};

function Loading({
  message = "Loading your workspace...",
  fullPage = true,
}: LoadingProps) {
  const containerClass = fullPage
    ? "flex min-h-[60vh] w-full items-center justify-center"
    : "flex w-full items-center justify-center py-8";

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/70 px-8 py-6 text-center shadow-lg backdrop-blur">
        <div className="relative size-12">
          <span className="absolute inset-0 rounded-full border-2 border-cyan-400/25" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-cyan-300/20" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-100">{message}</p>
          <p className="mt-1 text-xs text-slate-400">
            Extracting, validating, and preparing results.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Loading;
