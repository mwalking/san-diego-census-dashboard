import { useMemo, useState } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import maplibregl from 'maplibre-gl';
import Map from 'react-map-gl/maplibre';

const INITIAL_VIEW_STATE = {
  longitude: -117.1611,
  latitude: 32.7157,
  zoom: 9.5,
  pitch: 0,
  bearing: 0,
};

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

function MapShell() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const layers = useMemo(
    () => [
      new ScatterplotLayer({
        id: 'placeholder-empty-layer',
        data: [],
        pickable: false,
      }),
    ],
    [],
  );

  return (
    <section className="absolute inset-0">
      <DeckGL
        viewState={viewState}
        controller
        layers={layers}
        onViewStateChange={({ viewState: nextViewState }) => setViewState(nextViewState)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Map
          mapLib={maplibregl}
          mapStyle={BASEMAP_STYLE}
          attributionControl={false}
          style={{ width: '100%', height: '100%' }}
        />
      </DeckGL>
    </section>
  );
}

export default MapShell;
