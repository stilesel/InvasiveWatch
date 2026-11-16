# InvasiveWatch

InvasiveWatch is an interactive mapping project designed to help track
the spread of invasive species in the Ann Arbor, Michigan area.

Using research-grade observations from iNaturalist, InvasiveWatch
visualizes where and when invasive species have been observed,
making it easier to monitor their distribution and identify potential
areas of concern.

The long-term goal is to develop a tool that helps researchers,
conservation organizations, and invasive species management groups
monitor invasive species spread and respond to newly reported
observations.

## Features

- **Interactive map:** Visualize invasive species observations across
  the Ann Arbor area.
- **Species filtering:** Filter observations by individual species.
- **Date filtering:** View observations within a specified date range.
- **Species-specific markers:** Distinguish species using different
  marker colors.
- **Observation details:** View information about individual
  observations, including species, observation date, and iNaturalist link.
- **Observation statistics:** View summary statistics about the
  currently displayed observations.
- **Heat map:** Visualize the geographic concentration of observations.

## Data Sources

InvasiveWatch uses observation data from [iNaturalist](https://www.inaturalist.org/).

Observations are collected through the iNaturalist API and filtered
to include research-grade observations within the Ann Arbor area.

Each observation may include:
- Observation ID
- Species name
- Latitude and longitude
- Observation date

All observation data is attributed to iNaturalist and its contributors.

## Technologies

- **HTML/CSS:** Website structure and styling.
- **JavaScript:** Interactive map functionality and data processing.
- **Python:** Data collection and processing.
- **Leaflet.js:** Interactive mapping.
- **PapaParse:** CSV parsing.
- **OpenStreetMap:** Map tiles.
- **iNaturalist API:** Observation data.