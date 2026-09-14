import json
import pathlib
BASE = pathlib.Path(__file__).resolve().parent.parent / "src" / "i18n" / "translations"
BASE.mkdir(parents=True, exist_ok=True)
fr = {
  "app": {
    "name": "OFPPT - Système de Gestion des Présences",
    "shortName": "OFPPT Gestion des Présences",
    "tagline": "Suivi intelligent des présences",
    "loading": "Chargement...",
    "saving": "Enregistrement...",
    "submitting": "Envoi en cours...",
    "noData": "Aucune donnée disponible",
    "noResults": "Aucun résultat trouvé",
    "searchPlaceholder": "Rechercher...",
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "close": "Fermer",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "edit": "Modifier",
    "add": "Ajouter",
    "update": "Mettre à jour",
    "back": "Retour",
    "next": "Suivant",
    "previous": "Précédent",
    "yes": "Oui",
    "no": "Non",
    "all": "Tous",
    "select": "Sélectionner",
    "search": "Rechercher",
    "export": "Exporter CSV",
    "print": "Imprimer",
    "today": "Aujourd'hui",
    "viewAll": "Tout voir",
    "actions": "Actions",
    "total": "Total",
    "hours": "heures",
    "language": "Langue",
    "french": "Français",
    "english": "Anglais",
    "error": "Erreur"
  }
}
print("stub")