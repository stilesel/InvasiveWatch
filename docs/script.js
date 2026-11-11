
// InvasiveWatch dashboard
// Expected CSV columns:
// id,place_id,country,state,city,species,common_name,longitude,latitude,observed_on

console.log("NEW SCRIPT.JS LOADED");
const CSV_PATH = "data/observations.csv";

const ANN_ARBOR_CENTER = [42.2808, -83.7430];
const INITIAL_ZOOM = 12;

// Colors for different species
const SPECIES_COLORS = {
    "Lonicera maackii": "#3478a8",
    "Lycorma delicatula": "#d47b36"
};

const FALLBACK_COLORS = [
    "#668b57",
    "#9a70a8",
    "#bd9b3f",
    "#4c9990",
    "#b86666"
];

// Use the Leaflet map initialized in index.html
const map = window.map;

if (!map) {
    throw new Error(
        "Leaflet map was not initialized. Check index.html."
    );
}

// Layer to hold all observation markers
const markerLayer = L.layerGroup().addTo(map);

// Heat map layer
let heatLayer = null;

// Track whether heat-map mode is enabled
const heatmapToggle = document.getElementById("heatmap-toggle");
let heatmapEnabled = false; 

// Keep track of markers by their iNaturalist observation ID
const markersById = new Map();

let allObservations = [];
let colorBySpecies = {};

// Dashboard elements
const speciesFilter = document.getElementById("species-filter");
const startDateFilter = document.getElementById("start-date");
const endDateFilter = document.getElementById("end-date");


// Update the loading status
function setStatus(message, state = "") {
    const status = document.getElementById("data-status");

    if (status) {
        status.textContent = message;
        status.className = `data-status ${state}`.trim();
    }
}


// Validate each CSV row
function parseObservation(row) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);

    const id = String(row.id || "").trim();
    const species = String(row.species || "").trim();
    const commonName = String(row.common_name || "").trim();
    const observedOn = String(row.observed_on || "").trim();

    if (
        !id ||
        !species ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        return null;
    }

    if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return {
        id,
        placeId: row.place_id,
        country: row.country,
        state: row.state,
        city: row.city,
        species,
        commonName,
        latitude,
        longitude,
        observedOn
    };
}


// Assign a color to each species
function assignSpeciesColors(observations) {
    const speciesNames = [
        ...new Set(observations.map(item => item.species))
    ].sort();

    let fallbackIndex = 0;

    colorBySpecies = {};

    speciesNames.forEach(species => {
        colorBySpecies[species] =
            SPECIES_COLORS[species] ||
            FALLBACK_COLORS[
                fallbackIndex++ % FALLBACK_COLORS.length
            ];
    });
}


// Populate the species dropdown
function populateSpeciesFilter() {
    if (!speciesFilter) return;

    const selected = speciesFilter.value;

    speciesFilter.innerHTML =
        '<option value="all">All species</option>';

    [
        ...new Set(allObservations.map(item => item.species))
    ].sort().forEach(species => {
        const option = document.createElement("option");

        option.value = species;
        option.textContent = species;

        speciesFilter.appendChild(option);
    });

    if (
        [...speciesFilter.options].some(
            option => option.value === selected
        )
    ) {
        speciesFilter.value = selected;
    }
}


// Display the species legend
function renderLegend() {
    const container = document.getElementById("legend-items");

    if (!container) return;

    container.replaceChildren();

    const speciesNames = Object.keys(colorBySpecies);

    if (speciesNames.length === 0) {
        container.textContent = "No species in the dataset.";
        return;
    }

    speciesNames.forEach((species, index) => {
        const item = document.createElement("span");
        item.className = "legend-item";

        const swatch = document.createElement("span");
        swatch.className = "legend-swatch";
        swatch.style.backgroundColor = colorBySpecies[species];

        const label = document.createElement("span");
        const exampleObservation = allObservations.find(
            observation => observation.species === species
        );

        label.textContent = exampleObservation?.commonName
            ? `${exampleObservation.commonName} (${species})`
            : species;

        item.append(swatch, label);
        container.appendChild(item);
    });
}


// Create the popup shown when a pin is clicked
// Create the popup shown when a pin is clicked
function makePopup(observation) {
    const wrapper = document.createElement("div");

    const title = document.createElement("p");
    title.className = "popup-title";

    title.textContent = observation.commonName
        ? `${observation.commonName} (${observation.species})`
        : observation.species;

    const location = document.createElement("p");

    const locationParts = [
        observation.city,
        observation.state,
        observation.country
    ];

    location.textContent = locationParts
        .filter(Boolean)
        .join(", ");

    const date = document.createElement("p");
    date.textContent =
        `Observed: ${observation.observedOn || "Date not provided"}`;

    const id = document.createElement("p");
    id.textContent =
        `iNaturalist observation ID: ${observation.id}`;

    const link = document.createElement("a");

    link.href =
        `https://www.inaturalist.org/observations/${encodeURIComponent(observation.id)}`;

    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on iNaturalist";

    wrapper.append(title, location, date, id, link);

    return wrapper;
}

// Get observations matching the selected filters
function getFilteredObservations() {
    const selectedSpecies = speciesFilter?.value || "all";
    const startDate = startDateFilter?.value || "";
    const endDate = endDateFilter?.value || "";

    return allObservations.filter(observation => {

        if (
            selectedSpecies !== "all" &&
            observation.species !== selectedSpecies
        ) {
            return false;
        }

        if (
            startDate &&
            observation.observedOn &&
            observation.observedOn < startDate
        ) {
            return false;
        }

        if (
            endDate &&
            observation.observedOn &&
            observation.observedOn > endDate
        ) {
            return false;
        }

        if (
            (startDate || endDate) &&
            !observation.observedOn
        ) {
            return false;
        }

        return true;
    });
}


// Format dates for display
function formatDate(dateString) {
    if (!dateString) return "—";

    const parsed = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return dateString;
    }

    return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}


// Update dashboard statistics
function updateStatistics(observations) {
    const total = document.getElementById("stat-total");
    const speciesCount = document.getElementById("stat-species");
    const latest = document.getElementById("stat-latest");

    if (total) {
        total.textContent = observations.length.toLocaleString();
    }

    if (speciesCount) {
        speciesCount.textContent =
            new Set(observations.map(item => item.species)).size;
    }

    const dates = observations
        .map(item => item.observedOn)
        .filter(Boolean)
        .sort();

    if (latest) {
        latest.textContent = dates.length
            ? formatDate(dates[dates.length - 1])
            : "—";
    }

    const resultsLine = document.getElementById("results-line");

    if (resultsLine) {
        resultsLine.textContent =
            `Showing ${observations.length} of ${allObservations.length} observations.`;
    }
}


// Add one map pin for every observation
function renderMarkers(observations) {
    // Remove previously displayed pins
    markerLayer.clearLayers();
    markersById.clear();

    observations.forEach(observation => {
        
        // Get the color assigned to this species
        const markerColor = colorBySpecies[observation.species];

        // Create a traditional Leaflet map pin
        const marker = L.circleMarker([
            observation.latitude,
            observation.longitude
            ], {
                radius: 8,
                fillColor: markerColor,
                color: "#ffffff",
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
        });

        // Add observation information to the popup
        marker.bindPopup(makePopup(observation));

        // Add the pin to the map
        marker.addTo(markerLayer);

        // Associate the observation ID with its marker
        markersById.set(String(observation.id), marker);
    });
}

// Display observations as a heat map
// Display observations as a heat map
// Display observations as a heat map
function renderHeatMap(observations) {

    // Remove any previously created heat map
    if (heatLayer && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer);
    }

    // Hide individual observation pins
    if (map.hasLayer(markerLayer)) {
        map.removeLayer(markerLayer);
    }

    // Convert observations into heat-map coordinates
    const heatPoints = observations.map(observation => [
        observation.latitude,
        observation.longitude,
        0.6
    ]);

    // Create a fresh heat-map layer
    heatLayer = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 18,
        maxZoom: 17,
        max: 1,
        minOpacity: 0.3
    });

    // Add the new heat map to the map
    heatLayer.addTo(map);
}

// Display the observations currently shown on the map
function renderObservationList(observations) {

    const container = document.getElementById("observation-list");

    if (!container) return;

    // Remove the previous list
    container.replaceChildren();

    // Display a message if no observations match the filters
    if (observations.length === 0) {

        const emptyMessage = document.createElement("p");

        emptyMessage.className = "empty-observations";
        emptyMessage.textContent =
            "No observations match your current filters.";

        container.appendChild(emptyMessage);

        return;
    }


    const sortedObservations = [...observations].sort((a, b) => {
        // Observations without dates appear at the bottom
        if (!a.observedOn) return 1;
        if (!b.observedOn) return -1;

        // Newest dates appear first
        return b.observedOn.localeCompare(a.observedOn);
    });

    // Create one clickable item per observation
    sortedObservations.forEach(observation => {

        const item = document.createElement("button");

        item.type = "button";
        item.className = "observation-item";

        // Add the species color indicator
        const colorIndicator = document.createElement("span");

        colorIndicator.className = "observation-color";

        colorIndicator.style.backgroundColor =
            colorBySpecies[observation.species] || "#668b57";

        // Add observation information
        const details = document.createElement("span");

        details.className = "observation-details";

        const species = document.createElement("strong");

        species.className = "observation-species";

        species.textContent = observation.commonName
            ? `${observation.commonName} (${observation.species})`
            : observation.species;

        const date = document.createElement("span");

        date.className = "observation-date";
        date.textContent = formatDate(observation.observedOn);

        const id = document.createElement("span");

        id.className = "observation-id";
        id.textContent = `Observation #${observation.id}`;

        details.append(species, date, id);

        // Assemble the list item
        item.append(colorIndicator, details);

        // Zoom to the matching marker when clicked
        item.addEventListener("click", () => {

            // Switch back to individual pins if heat-map mode is active
            if (heatmapEnabled) {
                heatmapEnabled = false;

                if (heatmapToggle) {
                    heatmapToggle.checked = false;
                }

                applyFilters();
            }

            const marker = markersById.get(String(observation.id));

            if (!marker) return;

            const position = marker.getLatLng();

            // Zoom in and center the map on the observation
            map.setView(
                position,
                Math.max(map.getZoom(), 16),
                { animate: true }
            );

            // Open the marker's popup
            marker.openPopup();

        });

        container.appendChild(item);

    });
}

// Apply filters and update the map
// Apply filters and update the map
// Apply filters and update the map
// Apply filters and update the map
function applyFilters() {

    const filtered = getFilteredObservations();

    if (heatmapEnabled) {

        // Display heat map
        renderHeatMap(filtered);

    } else {

        // Remove heat map if it exists
        if (heatLayer && map.hasLayer(heatLayer)) {
            map.removeLayer(heatLayer);
        }

        heatLayer = null;

        // Display individual observation pins
        if (!map.hasLayer(markerLayer)) {
            markerLayer.addTo(map);
        }

        renderMarkers(filtered);
    }

    // Update the observation list and statistics
    renderObservationList(filtered);
    updateStatistics(filtered);
}


// Adjust map to show all observations
function resetMapView() {
    if (allObservations.length > 0) {

        const bounds = L.latLngBounds(
            allObservations.map(item => [
                item.latitude,
                item.longitude
            ])
        );

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [35, 35],
                maxZoom: 14
            });

            return;
        }
    }

    map.setView(ANN_ARBOR_CENTER, INITIAL_ZOOM);
}


// Load observations from the CSV file
async function loadObservations() {

    if (typeof Papa === "undefined") {
        setStatus("CSV parser failed to load.", "error");
        return;
    }

    try {
        setStatus("Loading observations...");

        const response = await fetch(CSV_PATH, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load CSV: HTTP ${response.status}`
            );
        }

        const csvText = await response.text();

        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim()
        });

        if (parsed.errors.length > 0) {
            console.warn("CSV parsing warnings:", parsed.errors);
        }

        // Convert CSV rows into observation objects
        allObservations = parsed.data
            .map(parseObservation)
            .filter(Boolean);

        // Prepare species colors and dashboard
        assignSpeciesColors(allObservations);

        populateSpeciesFilter();
        renderLegend();

        // Add pins and update statistics
        applyFilters();

        // Zoom to include all observations
        resetMapView();

        const skipped =
            parsed.data.length - allObservations.length;

        setStatus(
            `${allObservations.length} observations loaded.`,
            "success"
        );

        if (skipped > 0) {
            console.warn(
                `${skipped} CSV rows were skipped due to invalid data.`
            );
        }

    } catch (error) {
        console.error("Error loading observations:", error);

        setStatus(
            `Could not load observations: ${error.message}`,
            "error"
        );
    }
}


// Set up filter event listeners
speciesFilter?.addEventListener("change", applyFilters);
startDateFilter?.addEventListener("change", applyFilters);
endDateFilter?.addEventListener("change", applyFilters);
// Toggle between observation pins and heat-map display
heatmapToggle?.addEventListener("change", () => {
    heatmapEnabled = heatmapToggle.checked;
    applyFilters();
});


// Reset filters button
document.getElementById("reset-filters")
    ?.addEventListener("click", () => {

        if (speciesFilter) speciesFilter.value = "all";
        if (startDateFilter) startDateFilter.value = "";
        if (endDateFilter) endDateFilter.value = "";

        applyFilters();
    });


// Reset map view button
document.getElementById("reset-map")
    ?.addEventListener("click", resetMapView);


// Start loading the CSV
loadObservations();
