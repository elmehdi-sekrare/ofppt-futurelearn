import json
import pathlib

SEC = pathlib.Path("src/i18n/sections")
TR = pathlib.Path("src/i18n/translations")

fr_app = {
    "name": "OFPPT \u2013 Syst\u00e8me de Gestion des Pr\u00e9sences",
    "shortName": "OFPPT Gestion des Pr\u00e9sences",
    "tagline": "Suivi intelligent des pr\u00e9sences",
    "loading": "Chargement...",
    "saving": "Enregistrement...",
    "submitting": "Envoi...",
    "noData": "Aucune donn\u00e9e disponible",
    "noResults": "Aucun r\u00e9sultat trouv\u00e9",
    "searchPlaceholder": "Rechercher...",
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "close": "Fermer",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "edit": "Modifier",
    "add": "Ajouter",
    "update": "Mettre \u00e0 jour",
    "back": "Retour",
    "next": "Suivant",
    "previous": "Pr\u00e9c\u00e9dent",
    "yes": "Oui",
    "no": "Non",
    "all": "Tous",
    "select": "S\u00e9lectionner",
    "search": "Rechercher",
    "export": "Exporter CSV",
    "print": "Imprimer",
    "today": "Aujourd\u2019hui",
    "viewAll": "Tout voir",
    "actions": "Actions",
    "total": "Total",
    "hours": "heures",
    "language": "Langue",
    "french": "Fran\u00e7ais",
    "english": "Anglais",
    "error": "Erreur",
    "success": "Succ\u00e8s",
}

fr_auth = {
    "login": "Connexion",
    "logout": "D\u00e9connexion",
    "email": "Adresse e-mail",
    "password": "Mot de passe",
    "forgotPassword": "Mot de passe oubli\u00e9 ?",
    "rememberMe": "Se souvenir de moi",
    "signIn": "Se connecter",
    "signingIn": "Connexion en cours...",
    "invalidCredentials": "E-mail ou mot de passe incorrect",
    "loginFailed": "\u00c9chec de la connexion",
    "changePasswordRequired": "Changement de mot de passe requis",
    "mustChangePassword": "Vous devez modifier votre mot de passe pour des raisons de s\u00e9curit\u00e9.",
    "currentPassword": "Mot de passe actuel",
    "newPassword": "Nouveau mot de passe",
    "confirmPassword": "Confirmer le mot de passe",
    "passwordMismatch": "Les mots de passe ne correspondent pas",
    "passwordMinLength": "Le mot de passe doit contenir au moins 8 caract\u00e8res",
    "passwordChanged": "Mot de passe modifi\u00e9 avec succ\u00e8s",
    "changePassword": "Modifier le mot de passe",
    "welcomeBack": "Bon retour !",
    "signedInAs": "Connect\u00e9 en tant que {{name}}",
    "useYourAccount": "Connectez-vous avec votre compte pour continuer.",
    "demoCredentials": "Identifiants de d\u00e9monstration",
    "demoInfo": "Utilisez les identifiants ci-dessous pour explorer le syst\u00e8me.",
    "demoAccess": "Acc\u00e8s d\u00e9mo",
    "admin": "Admin",
    "teacher": "Enseignant",
    "student": "\u00c9l\u00e8ve",
    "roleStudent": "Vous vous connectez en tant qu\u2019\u00e9l\u00e8ve",
    "roleTeacher": "Vous vous connectez en tant qu\u2019enseignant",
    "roleAdmin": "Vous vous connectez en tant qu\u2019administrateur",
    "signInSubtitle": "Connectez-vous pour g\u00e9rer les pr\u00e9sences et les absences",
}

fr_nav = {
    "dashboard": "Tableau de bord",
    "students": "\u00c9l\u00e8ves",
    "teachers": "Enseignants",
    "groups": "Groupes",
    "rosters": "Listes",
    "absences": "Absences",
    "justifications": "Justifications",
    "risk": "Tableau des risques",
    "reports": "Rapports",
    "audit": "Journal d\u2019audit",
    "help": "Aide",
    "mark": "Saisir une absence",
    "history": "Historique",
    "roster": "Mes groupes",
    "modules": "Mes modules",
    "myAbsences": "Mes absences",
    "account": "Param\u00e8tres du compte",
}

fr_layout = {
    "collapse": "R\u00e9duire",
    "logout": "D\u00e9connexion",
    "searchPlaceholder": "Rechercher...",
    "accountSettings": "Param\u00e8tres du compte",
    "roleAdmin": "Administrateur",
    "roleTeacher": "Enseignant",
    "roleStudent": "\u00c9l\u00e8ve",
}

(SEC / "fr_common.json").write_text(json.dumps({"app": fr_app}, ensure_ascii=False, indent=2), encoding="utf-8")
(SEC / "fr_auth.json").write_text(json.dumps({"auth": fr_auth}, ensure_ascii=False, indent=2), encoding="utf-8")
(SEC / "fr_nav.json").write_text(json.dumps({"nav": fr_nav, "layout": fr_layout}, ensure_ascii=False, indent=2), encoding="utf-8")

fr_merged = {}
for p in sorted(SEC.glob("fr_*.json")):
    d = json.loads(p.read_text(encoding="utf-8"))
    for k, v in d.items():
        fr_merged[k] = v
(TR / "fr.json").write_text(json.dumps(fr_merged, ensure_ascii=False, indent=2), encoding="utf-8")

en_merged = {}
for p in sorted(SEC.glob("en_*.json")):
    d = json.loads(p.read_text(encoding="utf-8"))
    for k, v in d.items():
        en_merged[k] = v
# keep any extra en-only sections already in en.json translations but missing from sections
old_en = json.loads((TR / "en.json").read_text(encoding="utf-8"))
for k, v in old_en.items():
    if k not in en_merged:
        en_merged[k] = v
(TR / "en.json").write_text(json.dumps(en_merged, ensure_ascii=False, indent=2), encoding="utf-8")

print("FR keys:", sorted(fr_merged.keys()))
print("EN keys:", sorted(en_merged.keys()))
print("FR app.name:", fr_merged["app"]["name"])
print("OK")