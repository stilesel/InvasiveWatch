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

    # Retrieve observations for every supported species
    for species in config["species"]:
        posts = get_api_call.get_posts(
            species["name"],
            earliest_date
        )

        get_api_call.posts_to_csv(posts)

    # Only update the date after all species succeed
    LAST_RUN_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(LAST_RUN_FILE, "w") as file:
        json.dump(
            {"last_run": date.today().isoformat()},
            file,
            indent=4
        )

    print("InvasiveWatch collection completed!")


if __name__ == "__main__":
    main()