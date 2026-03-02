import { COPY } from '../ui/microcopy.js';

function toRgba(color) {
  if (!Array.isArray(color)) {
    return 'rgba(15, 23, 42, 0.85)';
  }

  const [r = 15, g = 23, b = 42, a = 255] = color;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a / 255))})`;
}

function LegendCard({
  geoMode,
  onGeoModeChange,
  activeMetricLabel,
  legendSubtext,
  quantileBins = [],
  isLoading,
}) {
  return (
    <section className="w-full rounded-xl border border-slate-200/10 bg-slate-900/85 p-4 shadow-xl backdrop-blur">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-100">{COPY.legend.title}</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {COPY.legend.toggleLabel}
        </span>
      </header>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-800/70 p-1">
        {COPY.legend.geoModes.map((mode) => {
          const isActive = geoMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              className={`rounded-md px-3 py-2 text-sm transition ${
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => onGeoModeChange(mode.id)}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-300">
        {legendSubtext ?? COPY.legend.modeSubtext[geoMode]}
      </p>
      <p className="mt-1 text-xs text-slate-400">{activeMetricLabel}</p>
      {isLoading ? <p className="mt-1 text-xs text-emerald-300">Loading…</p> : null}

      <div className="mt-4 space-y-2">
        {quantileBins.map((bin) => (
          <div key={bin.label} className="flex items-center gap-2 text-xs text-slate-300">
            <span
              className="inline-block h-3 w-6 rounded"
              style={{ backgroundColor: toRgba(bin.color) }}
              aria-hidden="true"
            />
            <span>{bin.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default LegendCard;
