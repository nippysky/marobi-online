export default function GlobalLoadingDots() {
  return (
    <div
      className="
        fixed inset-0 z-[9999]
        flex flex-col items-center justify-center
        bg-gradient-to-r from-brand to-green-900
      "
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="block h-2 w-2 rounded-full bg-neutral-200 animate-bounce [animation-delay:-0.2s]" />
          <span className="block h-2 w-2 rounded-full bg-neutral-200 animate-bounce [animation-delay:-0.1s]" />
          <span className="block h-2 w-2 rounded-full bg-neutral-200 animate-bounce" />
        </div>
        <p className="text-sm tracking-wide text-neutral-200 font-medium">
          Please wait…
        </p>
      </div>
    </div>
  );
}
