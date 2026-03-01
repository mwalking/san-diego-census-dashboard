import { COPY } from '../ui/microcopy.js';

function Sidebar({ year, onYearChange, activeMetricId, onActiveMetricChange }) {
  const years = COPY.sidebar.years;
  const yearIndex = Math.max(0, years.indexOf(year));

  function handleYearChange(event) {
    const nextIndex = Number(event.target.value);
    onYearChange(years[nextIndex]);
  }

  return (
    <aside className="h-full w-full overflow-auto rounded-xl border border-slate-200/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
      <h2 className="text-base font-semibold text-slate-100">{COPY.sidebar.title}</h2>
      <div className="mt-4 rounded-lg bg-slate-800/70 p-3">
        <div className="flex items-center justify-between text-sm text-slate-200">
          <span>{COPY.sidebar.yearLabel}</span>
          <span>{year}</span>
        </div>
        <input
          type="range"
          min="0"
          max={String(years.length - 1)}
          step="1"
          value={String(yearIndex)}
          onChange={handleYearChange}
          className="mt-2 w-full accent-emerald-400"
        />
      </div>
      <div className="mt-4 space-y-4">
        {COPY.sidebar.groups.map((group) => (
          <section key={group.id}>
            <h3 className="text-xs uppercase tracking-wide text-slate-400">{group.label}</h3>
            <div className="mt-2 space-y-1">
              {group.metrics.map((metric) => {
                const isActive = metric.id === activeMetricId;
                return (
                  <button
                    key={metric.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700'
                    }`}
                    onClick={() => onActiveMetricChange(metric.id)}
                  >
                    <span>{metric.label}</span>
                    <span className="text-xs text-slate-400">{COPY.sidebar.placeholderValue}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-5 rounded-lg bg-slate-800/70 p-3">
        <h3 className="text-xs uppercase tracking-wide text-slate-400">
          {COPY.sidebar.selectedAreaTitle}
        </h3>
        <p className="mt-2 text-sm text-slate-300">{COPY.sidebar.noAreaSelected}</p>
      </section>
    </aside>
  );
}

export default Sidebar;
