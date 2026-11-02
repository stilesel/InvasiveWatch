import csv
import requests
import time
import os
from datetime import datetime

from pathlib import Path

API_URL = 'https://api.inaturalist.org/v2/observations'

DATA_FILE = Path("data/observations.csv")

FIELDNAMES = [
    "id",
    "species",
    "longitude",
    "latitude",
    "observed_on"
]

def get_posts(species_name, earliest_date, num_results=50):
    session = requests.Session()

    session.headers.update({
        "User-Agent": "InvasiveWatch/1.0"
    })

    assert_valid_date(earliest_date)
    assert type(num_results) is int, "num_results must be an int"
    assert num_results <= 10000, "Cannot get more than 10000 results"

    params = {
        "fields": ["id","observed_on","geojson","taxon"], 
        "place_id": "50095",
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

                observations.append({
                    "id": observation["id"],
                    "species": species_name,
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
        print(f"API request failed: {e}")
        return None

def posts_to_csv(posts):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing_ids = set()

    if DATA_FILE.exists():
        with open(DATA_FILE, "r", newline="") as file:
            reader = csv.DictReader(file)
            existing_ids = {
                row["id"] for row in reader
            }

    new_posts = [
        post for post in posts
        if str(post["id"]) not in existing_ids
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
