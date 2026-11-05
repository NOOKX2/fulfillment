/** Read-only progress indicator. `current` is the 1-based active step; earlier steps show ✓. */
export function FlowSteps({ steps, current }: { steps: { label: string }[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={s.label}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
              done
                ? "bg-ink text-white"
                : active
                  ? "border-2 border-ink bg-gold text-ink"
                  : "border-2 border-dashed border-muted bg-white text-muted"
            }`}
          >
            <span aria-hidden>{done ? "✓" : n}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
