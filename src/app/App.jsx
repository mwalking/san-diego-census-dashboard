import { useEffect, useMemo, useState } from 'react';
import AboutModal from '../components/AboutModal.jsx';
import DataSourcesModal from '../components/DataSourcesModal.jsx';
import LegendCard from '../components/LegendCard.jsx';
import MapShell from '../components/MapShell.jsx';
import SelectionModeCard from '../components/SelectionModeCard.jsx';
import Sidebar from '../components/Sidebar.jsx';
import WelcomeModal from '../components/WelcomeModal.jsx';
import { COPY, getMetricById, STORAGE_KEYS } from '../ui/microcopy.js';

const DEFAULT_METRIC_ID = COPY.sidebar.groups[0].metrics[0].id;
const DEFAULT_YEAR = COPY.sidebar.years[COPY.sidebar.years.length - 1];

function App() {
  const [geoMode, setGeoMode] = useState('hex');
  const [selectionMode, setSelectionMode] = useState('single');
  const [activeMetricId, setActiveMetricId] = useState(DEFAULT_METRIC_ID);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [chooseForMeMessage, setChooseForMeMessage] = useState('');

  useEffect(() => {
    try {
      const wasDismissed =
        globalThis.localStorage?.getItem(STORAGE_KEYS.welcomeDismissed) === '1';
      setIsWelcomeOpen(!wasDismissed);
    } catch {
      setIsWelcomeOpen(true);
    }
  }, []);

  function handleWelcomeDismiss() {
    setIsWelcomeOpen(false);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEYS.welcomeDismissed, '1');
    } catch {
      // Ignore storage errors and continue.
    }
  }

  function handleChooseForMeClick() {
    setChooseForMeMessage(COPY.app.chooseForMePlaceholder);
  }

  const activeMetric = useMemo(() => getMetricById(activeMetricId), [activeMetricId]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="h-16 shrink-0 border-b border-slate-200/10 bg-slate-950/70 backdrop-blur">
        <div className="flex h-full items-center justify-between gap-3 px-4">
          <h1 className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">
            {COPY.app.name}
          </h1>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-2 text-xs text-slate-200 hover:bg-slate-800 sm:px-3 sm:text-sm"
              onClick={() => setIsDataSourcesOpen(true)}
            >
              {COPY.nav.dataSources}
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-2 text-xs text-slate-200 hover:bg-slate-800 sm:px-3 sm:text-sm"
              onClick={() => setIsAboutOpen(true)}
            >
              {COPY.nav.about}
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-400 px-2 py-2 text-xs font-semibold text-slate-900 sm:px-3 sm:text-sm"
              onClick={handleChooseForMeClick}
            >
              {COPY.nav.chooseForMe}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <div className="relative h-full w-full">
          <MapShell />

          {chooseForMeMessage ? (
            <p className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-md border border-emerald-400/30 bg-slate-900/90 px-3 py-2 text-xs text-emerald-300">
              {chooseForMeMessage}
            </p>
          ) : null}

          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="pointer-events-auto absolute left-4 top-4 w-[320px] max-w-[92vw]">
              <LegendCard
                geoMode={geoMode}
                onGeoModeChange={setGeoMode}
                activeMetricLabel={activeMetric?.label ?? ''}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-4 left-4 w-[320px] max-w-[92vw]">
              <SelectionModeCard
                selectionMode={selectionMode}
                onSelectionModeChange={setSelectionMode}
              />
            </div>

            <div className="pointer-events-auto absolute bottom-4 right-4 top-4 w-[360px] max-w-[92vw]">
              <Sidebar
                year={year}
                onYearChange={setYear}
                activeMetricId={activeMetricId}
                onActiveMetricChange={setActiveMetricId}
              />
            </div>
          </div>
        </div>
      </main>

      <WelcomeModal isOpen={isWelcomeOpen} onDismiss={handleWelcomeDismiss} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <DataSourcesModal isOpen={isDataSourcesOpen} onClose={() => setIsDataSourcesOpen(false)} />
    </div>
  );
}

export default App;
