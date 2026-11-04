import json
from datetime import date, timedelta
from pathlib import Path

import get_api_call


CONFIG_FILE = Path("config/config.json")
LAST_RUN_FILE = Path("data/last_run.json")


def load_json(path):
    with open(path, "r") as file:
        return json.load(file)


def main():
    config = load_json(CONFIG_FILE)

    # Determine when to start collecting observations
    if LAST_RUN_FILE.exists():
        last_run = load_json(LAST_RUN_FILE)["last_run"]
        earliest_date = (
            date.fromisoformat(last_run) - timedelta(days=8)
        ).isoformat()
    else:
        earliest_date = config["starting_date"]

    print(f"Collecting observations since {earliest_date}")

    all_posts = []

    # Retrieve observations for every location and species
    for location in config["locations"]:
        print(
            f"\nCollecting observations in "
            f"{location['city']}, {location['state']}, "
            f"{location['country']}..."
        )

        for species in config["species"]:
            print(f"Searching for {species['name']}...")

            posts = get_api_call.get_posts(
                species["name"],
                earliest_date,
                location
            )

            # Do not update last_run if any API request fails
            if posts is None:
                raise RuntimeError(
                    f"Failed to retrieve {species['name']} "
                    f"in {location['city']}"
                )

            all_posts.extend(posts)

    # Save all collected observations
    get_api_call.posts_to_csv(all_posts)

    # Only update the date after all species and locations succeed
    LAST_RUN_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(LAST_RUN_FILE, "w") as file:
        json.dump(
            {"last_run": date.today().isoformat()},
            file,
            indent=4
        )

    print("\nInvasiveWatch collection completed!")


if __name__ == "__main__":
    main()