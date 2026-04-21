# soil-satellite
Real Time Soil Moisture and Green Cover - Global

This is a static website with dynamic features like "live content updates". Note: The word "live" is used, but it is not truly "live"; content updates are done at adjustable intervals. Side-by-side maps of green cover and soil moisture.

- NASA SMAP L4 analyzed surface soil moisture **L4 layer chosen due to reduced complexity
- NASA MODIS Terra NDVI 16-day green cover

## How to run it

Download all of the files

This project is plain HTML, CSS, and JavaScript; you can open `index.html` directly in a browser. A small local web server is still the safest option for external data loading:

Navigate to the Python file in your terminal or PowerShell and run it. Then open locally in your browser using localhost:8000

## What the site does

- Lets the user zoom to a selected country
- Lets the user enter a custom latitude/longitude grid
- Shows soil moisture and green cover in synchronized maps
- Refreshes the NASA imagery automatically on a timer

## Main data sources

- NASA Earthdata SMAP overview: https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap
- NASA Earthdata soil moisture tools: https://www.earthdata.nasa.gov/topics/land-surface/soil-moisture-water-content/data-access-tools
- NASA MODIS vegetation index overview: https://modis.gsfc.nasa.gov/data/dataprod/mod13.php
- NASA GIBS imagery service: https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs
