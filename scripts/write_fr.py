import json
import os

fr_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'i18n', 'translations', 'fr.json')

# Load existing
with open(fr_path, 'r', encoding='utf-8') as f:
    fr = json.load(f)

# Add nav
fr['nav'] = {
    "dashboard": "Tableau de bord",
    "students": "Élèves",
    "teachers": "Professeurs",
    "groups": "Groupes",
    "absences": "Absences",
    "justifications": "Justifications",
    "account": "Paramètres du compte",
    "help": "Centre d'aide",
    "reports": "Rapports",
    "risk": "Risques",
    "audit": "Journal d'audit",
    "markAbsence": "Marquer une absence",
    "history": "Historique",
    "roster": "Effectif",
    "modules": "Modules"
}

# Add layout
fr['layout'] = {
    "sidebar": {
        "profile": "Profil",
        "settings": "Paramètres",
        "language": "Langue",
        "theme": "Thème",
        "logout": "Déconnexion"
    },
    "breadcrumbs": {
        "home": "Accueil",
        "dashboard": "Tableau de bord"
    },
    "topbar": {
        "notifications": "Notifications",
        "markAllRead": "Tout marquer comme lu",
        "clearAll": "Tout effacer",
        "noNotifications": "Aucune notification",
        "noNotificationsMessage": "Aucune notification pour l'instant."
    }
}

# Add dashboard
fr['dashboard'] = {
    "welcome": "Bonjour, {name}",
    "welcomeSubtitle": "Bienvenue sur votre tableau de bord",
    "overview": "Aperçu",
    "stats": "Statistiques",
    "recentActivity": "Activité récente",
    "quickActions": "Actions rapides",
    "noActivity": "Aucune activité récente",
    "autoRefresh": "Actualisation auto. 30s",
    "showMoreEvents": "Afficher {count} autres événements",
    "noEvents": "Aucun événement",
    "totalStudents": "Total des élèves",
    "totalTeachers": "Total des professeurs",
    "totalGroups": "Total des groupes",
    "totalAbsences": "Total des absences",
    "justificationRate": "Taux de justification",
    "attendanceRate": "Taux de présence",
    "absenceRecorded": "Absence enregistrée",
    "justificationSubmitted": "Justification soumise",
    "justificationApproved": "Justification approuvée",
    "justificationRejected": "Justification rejetée"
}

# Add students
fr['students'] = {
    "title": "Élèves",
    "subtitle": "Gérer les élèves",
    "addStudent": "Ajouter un élève",
    "editStudent": "Modifier l'élève",
    "searchPlaceholder": "Rechercher un élève...",
    "noStudents": "Aucun élève trouvé",
    "studentId": "N° élève",
    "name": "Nom",
    "firstName": "Prénom",
    "lastName": "Nom de famille",
    "email": "E-mail",
    "phone": "Téléphone",
    "cne": "CNE",
    "group": "Groupe",
    "teacher": "Professeur",
    "status": "Statut",
    "activeStatus": "Actif",
    "inactiveStatus": "Inactif",
    "addSuccess": "Élève ajouté avec succès",
    "updateSuccess": "Élève modifié avec succès",
    "deleteSuccess": "Élève supprimé avec succès",
    "deleteConfirmTitle": "Supprimer l'élève",
    "deleteConfirmDesc": "Êtes-vous sûr de vouloir supprimer {name} ?",
    "details": "Détails de l'élève",
    "present": "Présent",
    "absent": "Absent",
    "late": "En retard",
    "overallAttendance": "Présence globale",
    "totalAbsenceHours": "Heures d'absence totales",
    "subjects": "Matières",
    "recentAbsences": "Absences récentes"
}

# Add teachers
fr['teachers'] = {
    "title": "Professeurs",
    "subtitle": "Gérer les professeurs",
    "addTeacher": "Ajouter un professeur",
    "editTeacher": "Modifier le professeur",
    "searchPlaceholder": "Rechercher un professeur...",
    "noTeachers": "Aucun professeur trouvé",
    "teacherId": "N° professeur",
    "name": "Nom",
    "firstName": "Prénom",
    "lastName": "Nom de famille",
    "email": "E-mail",
    "phone": "Téléphone",
    "photo": "Photo",
    "subjects": "Matières",
    "studentCount": "Nombre d'élèves",
    "status": "Statut",
    "activeStatus": "Actif",
    "inactiveStatus": "Inactif",
    "addSuccess": "Professeur ajouté avec succès",
    "updateSuccess": "Professeur modifié avec succès",
    "deleteSuccess": "Professeur supprimé avec succès",
    "deleteConfirmTitle": "Supprimer le professeur",
    "deleteConfirmDesc": "Êtes-vous sûr de vouloir supprimer {name} ?",
    "details": "Détails du professeur"
}

# Add groups
fr['groups'] = {
    "title": "Groupes",
    "subtitle": "Gérer les groupes",
    "addGroup": "Ajouter un groupe",
    "editGroup": "Modifier le groupe",
    "searchPlaceholder": "Rechercher un groupe...",
    "noGroups": "Aucun groupe trouvé",
    "groupName": "Nom du groupe",
    "level": "Niveau",
    "filiere": "Filière",
    "studentCount": "Nombre d'élèves",
    "teacherCount": "Nombre de professeurs",
    "averageAttendance": "Présence moyenne",
    "status": "Statut",
    "activeStatus": "Actif",
    "inactiveStatus": "Inactif",
    "addSuccess": "Groupe ajouté avec succès",
    "updateSuccess": "Groupe modifié avec succès",
    "deleteSuccess": "Groupe supprimé avec succès",
    "deleteConfirmTitle": "Supprimer le groupe",
    "deleteConfirmDesc": "Êtes-vous sûr de vouloir supprimer {name} ?",
    "details": "Détails du groupe"
}

with open(fr_path, 'w', encoding='utf-8') as f:
    json.dump(fr, f, ensure_ascii=False, indent=2)

print(f'fr.json updated with {len(fr)} root keys')
