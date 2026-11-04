import csv
import requests
import time
import os
from datetime import datetime

from pathlib import Path

API_URL = 'https://api.inaturalist.org/v2/observations'

DATA_FILE = Path("docs/data/observations.csv")

FIELDNAMES = [
    "id",
    "place_id",
    "country",
    "state",
    "city",
    "species",
    "common_name",
    "longitude",
    "latitude",
    "observed_on"
]

def get_posts(species_name, earliest_date, location):
    session = requests.Session()

    session.headers.update({
        "User-Agent": "InvasiveWatch/1.0"
    })

    assert_valid_date(earliest_date)

    params = {
        "fields": "id,observed_on,geojson,taxon.id,taxon.name,taxon.preferred_common_name", 
        "place_id": location["place_id"],
        "d1": earliest_date,
        "taxon_name": species_name,
        "quality_grade": "research",
        "per_page": 200,
        "page": 1
    }

    observations = []

    try:
        while True:
            response = session.get(
                API_URL,
                params=params,
                timeout=30
            )

            response.raise_for_status()

            data = response.json()
            results = data.get("results", [])

            if not results:
                break

            for observation in results:
                coordinates = observation.get(
                    "geojson", {}
                ).get("coordinates")

                # Skip observations without coordinates
                if not coordinates:
                    continue

                taxon = observation.get("taxon") or {}

                observations.append({
                    "id": observation["id"],
                    "place_id": location["place_id"],
                    "country": location["country"],
                    "state": location.get("state", ""),
                    "city": location["city"],
                    "species": species_name,
                    "common_name": taxon.get(
                        "preferred_common_name", ""
                    ),
                    "longitude": coordinates[0],
                    "latitude": coordinates[1],
                    "observed_on": observation.get("observed_on")
                })

            # Stop when there are no more pages
            if len(results) < params["per_page"]:
                break

            params["page"] += 1

            # Be considerate of the iNaturalist API
            time.sleep(1)

        return observations

    except requests.exceptions.RequestException as e:
        # Handle any network-related errors or exceptions
        print(f"API request failed for {species_name} in {location["city"]}: {e}")   
        return None

def posts_to_csv(posts):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing_observations = set()

    if DATA_FILE.exists():
        with open(DATA_FILE, "r", newline="") as file:
            reader = csv.DictReader(file)

            for row in reader:
                # An observation is unique to its ID and location
                existing_observations.add(
                    (row.get("id"), row.get("place_id"))
                )

    new_posts = [
        post for post in posts
        if (str(post["id"]), post["place_id"]) not in existing_observations
    ]

    if not new_posts:
        print("No new observations found.")
        return

    file_exists = DATA_FILE.exists()

    with open(DATA_FILE, "a", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=FIELDNAMES
        )

        if not file_exists:
            writer.writeheader()

        writer.writerows(new_posts)

    print(f"Added {len(new_posts)} new observations.")



def assert_valid_date(date_string, date_format="%Y-%m-%d"):
    try:
        datetime.strptime(date_string, date_format)
    except ValueError:
        raise AssertionError(f"'{date_string}' does not match valid date syntax '{date_format}'")
