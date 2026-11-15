"""Build the Oddness content database and Markdown listing from the data files.

Usage:  python build.py
Reads   data/categories-*.txt and data/objects-*.txt
Writes  oddness.db and oddness-content.md (both rebuilt from scratch each run)
"""
import glob
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
DB_PATH = os.path.join(HERE, "oddness.db")
MD_PATH = os.path.join(HERE, "oddness-content.md")

SCENES_PER_CATEGORY = 50
FIT_PER_SCENE = 50
ILL_PER_SCENE = 25

problems = []


def split_items(text):
    return [item.strip() for item in text.split(";") if item.strip()]


def read_categories():
    categories = {}  # number -> dict(name, note, scenes)
    for path in sorted(glob.glob(os.path.join(DATA, "categories-*.txt"))):
        current = None
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line:
                    continue
                if line.startswith("#"):
                    number, name, note = [part.strip() for part in line[1:].split("|")]
                    current = {"name": name, "note": note, "scenes": []}
                    if int(number) in categories:
                        problems.append(f"Category {number} defined twice")
                    categories[int(number)] = current
                else:
                    current["scenes"].extend(split_items(line))
    return categories


def read_objects():
    objects = {}  # (category number, scene) -> dict(fit, ill)
    for path in sorted(glob.glob(os.path.join(DATA, "objects-*.txt"))):
        number = None
        current = None
        with open(path, encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line:
                    continue
                if line.startswith("#"):
                    number = int(line[1:].strip())
                elif line.startswith("@"):
                    scene = line[1:].strip()
                    if (number, scene) in objects:
                        problems.append(f"{number} / {scene}: objects given twice")
                    current = {"fit": [], "ill": []}
                    objects[(number, scene)] = current
                elif line.startswith("+"):
                    current["fit"].extend(split_items(line[1:]))
                elif line.startswith("-"):
                    current["ill"].extend(split_items(line[1:]))
                else:
                    problems.append(f"{os.path.basename(path)}: unreadable line: {line[:60]}")
    return objects


def duplicates(items):
    seen, repeated = set(), []
    for item in items:
        key = item.lower()
        if key in seen:
            repeated.append(item)
        seen.add(key)
    return repeated


def validate(categories, objects):
    if sorted(categories) != list(range(1, 101)):
        problems.append(f"Expected categories 1-100, found {len(categories)}")
    names = [c["name"] for c in categories.values()]
    for name in duplicates(names):
        problems.append(f"Duplicate category name: {name}")
    for number, cat in sorted(categories.items()):
        scenes = cat["scenes"]
        if len(scenes) != SCENES_PER_CATEGORY:
            problems.append(f"{number:03d} {cat['name']}: {len(scenes)} scenes")
        for scene in duplicates(scenes):
            problems.append(f"{number:03d} {cat['name']}: duplicate scene '{scene}'")
    for (number, scene), lists in sorted(objects.items()):
        label = f"{number:03d} / {scene}"
        if number not in categories or scene not in categories[number]["scenes"]:
            problems.append(f"{label}: scene is not in the category list")
        if len(lists["fit"]) != FIT_PER_SCENE:
            problems.append(f"{label}: {len(lists['fit'])} fitting objects")
        if len(lists["ill"]) != ILL_PER_SCENE:
            problems.append(f"{label}: {len(lists['ill'])} ill-fitting objects")
        for item in duplicates(lists["fit"]):
            problems.append(f"{label}: duplicate fitting object '{item}'")
        for item in duplicates(lists["ill"]):
            problems.append(f"{label}: duplicate ill-fitting object '{item}'")
        both = {i.lower() for i in lists["fit"]} & {i.lower() for i in lists["ill"]}
        for item in sorted(both):
            problems.append(f"{label}: '{item}' is listed as both fitting and ill-fitting")


def build_database(categories, objects):
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE Category (
            CategoryId INTEGER PRIMARY KEY,
            Name       TEXT NOT NULL UNIQUE,
            Note       TEXT NOT NULL
        );
        CREATE TABLE Scene (
            SceneId    INTEGER PRIMARY KEY,
            CategoryId INTEGER NOT NULL REFERENCES Category(CategoryId),
            Name       TEXT NOT NULL,
            UNIQUE (CategoryId, Name)
        );
        CREATE TABLE Object (
            ObjectId   INTEGER PRIMARY KEY,
            Name       TEXT NOT NULL UNIQUE
        );
        -- Fit maps objects to scenes. Fits = 1 for a fitting object, 0 for an ill-fitting one.
        CREATE TABLE Fit (
            SceneId    INTEGER NOT NULL REFERENCES Scene(SceneId),
            ObjectId   INTEGER NOT NULL REFERENCES Object(ObjectId),
            Fits       INTEGER NOT NULL CHECK (Fits IN (0, 1)),
            PRIMARY KEY (SceneId, ObjectId)
        );
        CREATE INDEX FitByObject ON Fit(ObjectId);
        -- Flat view with the four requested columns.
        CREATE VIEW Oddness AS
            SELECT c.Name AS Category, s.Name AS Scene, o.Name AS Object,
                   CASE f.Fits WHEN 1 THEN 'Fitting' ELSE 'Ill-fitting' END AS Fit
            FROM Fit f
            JOIN Scene s    ON s.SceneId = f.SceneId
            JOIN Category c ON c.CategoryId = s.CategoryId
            JOIN Object o   ON o.ObjectId = f.ObjectId;
        """
    )
    object_ids = {}
    scene_id = 0
    for number, cat in sorted(categories.items()):
        db.execute("INSERT INTO Category VALUES (?, ?, ?)", (number, cat["name"], cat["note"]))
        for scene in cat["scenes"]:
            scene_id += 1
            db.execute("INSERT INTO Scene VALUES (?, ?, ?)", (scene_id, number, scene))
            lists = objects.get((number, scene))
            if not lists:
                continue
            for fits, items in ((1, lists["fit"]), (0, lists["ill"])):
                for item in items:
                    if item not in object_ids:
                        object_ids[item] = len(object_ids) + 1
                        db.execute("INSERT INTO Object VALUES (?, ?)", (object_ids[item], item))
                    db.execute(
                        "INSERT OR IGNORE INTO Fit VALUES (?, ?, ?)",
                        (scene_id, object_ids[item], fits),
                    )
    db.commit()
    counts = {
        table: db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in ("Category", "Scene", "Object", "Fit")
    }
    db.close()
    return counts


def build_markdown(categories, objects, counts):
    done = sorted({number for number, _ in objects})
    lines = [
        "# Oddness – Scene Content",
        "",
        "*Generated by `build.py` from the files in `data/`. Do not edit this file by hand.*",
        "",
        "## Status",
        "",
        "| | Count |",
        "|---|---|",
        f"| Categories | {counts['Category']} |",
        f"| Scenes | {counts['Scene']} |",
        f"| Scenes with object lists | {len(objects)} |",
        f"| Distinct objects | {counts['Object']} |",
        f"| Object-to-scene fit entries | {counts['Fit']} |",
        "",
        "Categories with complete object lists: "
        + (", ".join(f"{n:03d} {categories[n]['name']}" for n in done) or "none")
        + ".",
        "",
        "## Categories",
        "",
        "| # | Category | What the player learns | Objects |",
        "|---|---|---|---|",
    ]
    for number, cat in sorted(categories.items()):
        state = "Complete" if number in done else "Scenes only"
        lines.append(f"| {number:03d} | {cat['name']} | {cat['note']} | {state} |")
    lines.append("")
    for number, cat in sorted(categories.items()):
        lines += [f"## {number:03d}. {cat['name']}", "", cat["note"], ""]
        if number in done:
            for index, scene in enumerate(cat["scenes"], 1):
                lists = objects.get((number, scene))
                lines += [f"### {number:03d}.{index:02d} {scene}", ""]
                if lists:
                    lines += [
                        f"**Fitting ({len(lists['fit'])}):** " + ", ".join(lists["fit"]),
                        "",
                        f"**Ill-fitting ({len(lists['ill'])}):** " + ", ".join(lists["ill"]),
                        "",
                    ]
        else:
            for index, scene in enumerate(cat["scenes"], 1):
                lines.append(f"{index}. {scene}")
            lines.append("")
    with open(MD_PATH, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(lines))


def main():
    categories = read_categories()
    objects = read_objects()
    validate(categories, objects)
    counts = build_database(categories, objects)
    build_markdown(categories, objects, counts)
    print(counts, "| scenes with objects:", len(objects))
    if problems:
        print(f"{len(problems)} problem(s):")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)
    print("No problems found.")


if __name__ == "__main__":
    main()
