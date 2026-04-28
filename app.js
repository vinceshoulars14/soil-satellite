const COUNTRY_GEOJSON_URL =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
const GIBS_WMS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const DEFAULT_VIEW_BOUNDS = [
  [24, -125],
  [50, -66],
];

const DATASETS = {
  surfaceSoil: {
    id: "SMAP_L4_Analyzed_Surface_Soil_Moisture",
    title: "SMAP L4 Surface Soil Moisture",
    subtitle: "NASA SMAP L4 analyzed soil moisture for the top 0-5 cm",
    maxNativeZoom: 8,
  },
  rootZoneSoil: {
    id: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture",
    title: "SMAP L4 Root-Zone Soil Moisture",
    subtitle: "NASA SMAP L4 analyzed root-zone moisture for the top 0-100 cm",
    maxNativeZoom: 8,
  },
  surfaceUncertainty: {
    id: "SMAP_L4_Uncertainty_Analyzed_Surface_Soil_Moisture",
    title: "SMAP L4 Surface Moisture Uncertainty",
    subtitle: "NASA SMAP L4 uncertainty for the analyzed 0-5 cm moisture layer",
    maxNativeZoom: 8,
  },
  rootZoneUncertainty: {
    id: "SMAP_L4_Uncertainty_Analyzed_Root_Zone_Soil_Moisture",
    title: "SMAP L4 Root-Zone Moisture Uncertainty",
    subtitle: "NASA SMAP L4 uncertainty for the analyzed 0-100 cm moisture layer",
    maxNativeZoom: 8,
  },
  vegetation: {
    id: "MODIS_Terra_L3_NDVI_16Day",
    title: "MODIS Terra NDVI 16-Day",
    subtitle: "NASA MODIS Terra NDVI 16-day vegetation index",
    maxNativeZoom: 9,
  },
};

const MAP_CONFIGS = [
  { elementId: "surfaceSoilMap", dataset: DATASETS.surfaceSoil },
  { elementId: "rootZoneSoilMap", dataset: DATASETS.rootZoneSoil },
  { elementId: "surfaceUncertaintyMap", dataset: DATASETS.surfaceUncertainty },
  { elementId: "rootZoneUncertaintyMap", dataset: DATASETS.rootZoneUncertainty },
  { elementId: "vegetationMap", dataset: DATASETS.vegetation },
];

const state = {
  selectedAreaLabel: "Continental United States",
  countries: [],
  countryLookup: new Map(),
  refreshTimerId: null,
};

const elements = {
  countrySelect: document.querySelector("#countrySelect"),
  fitCountryButton: document.querySelector("#fitCountryButton"),
  applyGridButton: document.querySelector("#applyGridButton"),
  refreshSelect: document.querySelector("#refreshSelect"),
  refreshStatus: document.querySelector("#refreshStatus"),
  areaLabel: document.querySelector("#areaLabel"),
  timestampLabel: document.querySelector("#timestampLabel"),
  minLat: document.querySelector("#minLat"),
  maxLat: document.querySelector("#maxLat"),
  minLon: document.querySelector("#minLon"),
  maxLon: document.querySelector("#maxLon"),
};

const maps = MAP_CONFIGS.map(({ elementId, dataset }) => {
  const map = createMap(elementId);
  map.datasetConfig = dataset;
  return map;
});

let syncingMaps = false;

initialize();

async function initialize() {
  maps.forEach((map) => {
    addSatelliteLayer(map, map.datasetConfig);
  });
  fitAllMapsToBounds(DEFAULT_VIEW_BOUNDS);
  syncMaps();
  updateRefreshedTimestamp();
  configureEvents();
  startRefreshTimer(Number(elements.refreshSelect.value));

  try {
    await loadCountries();
  } catch (error) {
    console.error(error);
    elements.countrySelect.innerHTML = "<option value=''>Countries unavailable</option>";
  }
}

function createMap(elementId) {
  const map = L.map(elementId, {
    worldCopyJump: true,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
  }).addTo(map);

  return map;
}

function addSatelliteLayer(map, dataset) {
  if (map.datasetLayer) {
    map.removeLayer(map.datasetLayer);
  }

  map.datasetLayer = L.tileLayer.wms(GIBS_WMS_URL, {
    layers: dataset.id,
    format: "image/png",
    transparent: true,
    styles: "",
    version: "1.1.1",
    opacity: 0.78,
    maxNativeZoom: dataset.maxNativeZoom,
    maxZoom: 12,
    attribution:
      'Satellite imagery: <a href="https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs">NASA Earthdata GIBS</a>',
    crossOrigin: true,
  }).addTo(map);
}

function syncMaps() {
  maps.forEach((sourceMap, index) => {
    sourceMap.on("moveend zoomend", () => {
      if (syncingMaps) {
        return;
      }

      syncingMaps = true;
      const center = sourceMap.getCenter();
      const zoom = sourceMap.getZoom();

      maps.forEach((targetMap, targetIndex) => {
        if (index !== targetIndex) {
          targetMap.setView(center, zoom, { animate: false });
        }
      });

      syncingMaps = false;
    });
  });
}

function configureEvents() {
  elements.fitCountryButton.addEventListener("click", () => {
    const countryCode = elements.countrySelect.value;
    if (!countryCode) {
      return;
    }

    const bounds = state.countryLookup.get(countryCode);
    if (!bounds) {
      return;
    }

    state.selectedAreaLabel =
      elements.countrySelect.options[elements.countrySelect.selectedIndex].textContent;
    updateAreaLabel();
    fitAllMapsToBounds(bounds);
  });

  elements.applyGridButton.addEventListener("click", () => {
    const bounds = getGridBoundsFromInputs();
    if (!bounds) {
      return;
    }

    state.selectedAreaLabel = "Custom latitude/longitude grid";
    updateAreaLabel();
    fitAllMapsToBounds(bounds);
  });

  elements.refreshSelect.addEventListener("change", () => {
    const interval = Number(elements.refreshSelect.value);
    startRefreshTimer(interval);
  });
}

async function loadCountries() {
  const response = await fetch(COUNTRY_GEOJSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to load country boundaries: ${response.status}`);
  }

  const geojson = await response.json();
  state.countries = geojson.features
    .map((feature) => {
      const name = feature.properties.name;
      const bounds = L.geoJSON(feature).getBounds();
      return {
        name,
        code: slugify(name),
        bounds: [
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()],
        ],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  state.countryLookup.clear();
  state.countries.forEach((country) => {
    state.countryLookup.set(country.code, country.bounds);
  });

  const options = [
    "<option value=''>Select a country</option>",
    ...state.countries.map(
      (country) => `<option value="${country.code}">${country.name}</option>`,
    ),
  ];

  elements.countrySelect.innerHTML = options.join("");
  const defaultCountry = state.countries.find((country) => country.name === "United States");
  if (defaultCountry) {
    elements.countrySelect.value = defaultCountry.code;
  }
}

function getGridBoundsFromInputs() {
  const minLat = Number(elements.minLat.value);
  const maxLat = Number(elements.maxLat.value);
  const minLon = Number(elements.minLon.value);
  const maxLon = Number(elements.maxLon.value);

  const values = [minLat, maxLat, minLon, maxLon];
  if (values.some((value) => Number.isNaN(value))) {
    window.alert("Please enter valid numeric latitude and longitude values.");
    return null;
  }

  if (minLat >= maxLat || minLon >= maxLon) {
    window.alert("Minimum values must be smaller than maximum values.");
    return null;
  }

  if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
    window.alert("Latitude must stay between -90 and 90, and longitude between -180 and 180.");
    return null;
  }

  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

function fitAllMapsToBounds(bounds) {
  maps.forEach((map) => {
    map.fitBounds(bounds, {
      padding: [18, 18],
      animate: false,
    });
  });
}

function startRefreshTimer(interval) {
  if (state.refreshTimerId) {
    window.clearInterval(state.refreshTimerId);
    state.refreshTimerId = null;
  }

  if (!interval) {
    elements.refreshStatus.textContent = "Auto-refresh is off. The current layers stay visible until you reload the page.";
    return;
  }

  const minutes = Math.round(interval / 60000);
  elements.refreshStatus.textContent = `Auto-refresh is on and checks every ${minutes} minute${minutes === 1 ? "" : "s"}.`;

  state.refreshTimerId = window.setInterval(() => {
    maps.forEach((map) => {
      addSatelliteLayer(map, map.datasetConfig);
    });
    updateRefreshedTimestamp();
  }, interval);
}

function updateRefreshedTimestamp() {
  const now = new Date();
  elements.timestampLabel.textContent = now.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  updateAreaLabel();
}

function updateAreaLabel() {
  elements.areaLabel.textContent = state.selectedAreaLabel;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
