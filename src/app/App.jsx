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
      const wasDismissed = globalThis.localStorage?.getItem(STORAGE_KEYS.welcomeDismissed) === '1';
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <MapShell />

      <header className="absolute inset-x-0 top-0 z-30 border-b border-slate-200/10 bg-slate-950/70 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{COPY.app.name}</h1>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => setIsDataSourcesOpen(true)}
            >
              {COPY.nav.dataSources}
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => setIsAboutOpen(true)}
            >
              {COPY.nav.about}
            </button>
            <button
              type="button"
              className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={handleChooseForMeClick}
            >
              {COPY.nav.chooseForMe}
            </button>
          </nav>
        </div>
        {chooseForMeMessage ? (
          <p className="mx-auto mt-2 w-full max-w-7xl text-xs text-emerald-300">
            {chooseForMeMessage}
          </p>
        ) : null}
      </header>

      <div className="pointer-events-none absolute inset-0 z-20 p-4 pt-24">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex w-full flex-col gap-4 lg:h-full lg:max-w-sm lg:justify-between">
            <div className="pointer-events-auto">
              <LegendCard
                geoMode={geoMode}
                onGeoModeChange={setGeoMode}
                activeMetricLabel={activeMetric?.label ?? ''}
              />
            </div>
            <div className="pointer-events-auto lg:mb-0">
              <SelectionModeCard
                selectionMode={selectionMode}
                onSelectionModeChange={setSelectionMode}
              />
            </div>
          </div>

          <div className="pointer-events-auto w-full lg:max-w-md lg:self-stretch">
            <Sidebar
              year={year}
              onYearChange={setYear}
              activeMetricId={activeMetricId}
              onActiveMetricChange={setActiveMetricId}
            />
          </div>
        </div>
      </div>

      <WelcomeModal isOpen={isWelcomeOpen} onDismiss={handleWelcomeDismiss} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <DataSourcesModal isOpen={isDataSourcesOpen} onClose={() => setIsDataSourcesOpen(false)} />
    </div>
  );
}

export default App;
