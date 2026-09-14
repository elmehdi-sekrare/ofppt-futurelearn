import json
import pathlib
import collections

ROOT = pathlib.Path("src/i18n")
SECTIONS = ROOT / "sections"
OUT = ROOT / "translations"


def load_merged(prefix):
    merged = collections.OrderedDict()
    for p in sorted(SECTIONS.glob(f"{prefix}_*.json")):
        data = json.loads(p.read_bytes().decode("utf-8-sig"))
        for key, value in data.items():
            if isinstance(value, dict):
                merged.setdefault(key, collections.OrderedDict()).update(value)
            else:
                merged[key] = value
    return merged


def main():
    fr = load_merged("fr")
    en = load_merged("en")
    old_fr_path = OUT / "fr.json"
    try:
        old_fr = json.loads(old_fr_path.read_bytes().decode("latin1"))
    except Exception:
        old_fr = {}
    for section, values in old_fr.items():
        if isinstance(values, dict):
            target = fr.setdefault(section, collections.OrderedDict())
            for k, v in values.items():
                target.setdefault(k, v)
    app = fr.get("app", collections.OrderedDict())
    app["name"] = "OFPPT - Syst\u00e8me de Gestion des Pr\u00e9sences"
    app["shortName"] = "OFPPT Gestion des Pr\u00e9sences"
    app["tagline"] = "Suivi intelligent des pr\u00e9sences"
    app["noData"] = "Aucune donn\u00e9e disponible"
    app["noResults"] = "Aucun r\u00e9sultat trouv\u00e9"
    app["previous"] = "Pr\u00e9c\u00e9dent"
    app["select"] = "S\u00e9lectionner"
    app["french"] = "Fran\u00e7ais"
    fr["app"] = app
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "fr.json").write_text(json.dumps(fr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "en.json").write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT / "fr.json", "roots:", sorted(fr.keys()))
    print("wrote", OUT / "en.json", "roots:", sorted(en.keys()))


if __name__ == "__main__":
    main()