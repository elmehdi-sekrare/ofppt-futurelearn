const fs = require('fs');
const path = require('path');

// Read current fr.json
const frPath = path.join(__dirname, '..', 'src', 'i18n', 'translations', 'fr.json');
let fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));

// Add absences section
fr.absences = {
  title: "Absences",
  subtitle: "Gérer les absences",
  markAbsence: "Marquer une absence",
  markAbsenceTitle: "Enregistrer une absence",
  markAbsenceSubtitle: "Enregistrer une nouvelle absence",
  history: "Historique des absences",
  historySubtitle: "Consultez l'historique des absences",
  allAbsences: "Toutes les absences",
  pendingAbsences: "Absences en attente",
  justifiedAbsences: "Absences justifiées",
  unjustifiedAbsences: "Absences non justifiées",
  myAbsences: "Mes absences",
  studentAbsencesTitle: "Mes absences",
  studentAbsencesSubtitle: "Consultez votre historique d'absences",
  selectStudent: "Sélectionner un élève",
  selectGroup: "Sélectionner un groupe",
  selectTeacher: "Sélectionner un professeur",
  selectSubject: "Sélectionner une matière",
  dateLabel: "Date",
  hoursLabel: "Heures",
  typeLabel: "Type",
  statusLabel: "Statut",
  studentLabel: "Élève",
  groupLabel: "Groupe",
  teacherLabel: "Professeur",
  subjectLabel: "Matière",
  reasonLabel: "Motif",
  justificationLabel: "Justification",
  pending: "En attente",
  justified: "Justifiée",
  unjustified: "Non justifiée",
  voided: "Annulée",
  late: "En retard",
  lateMinutes: "{{minutes}} min de retard",
  totalHours: "Heures totales",
  averageDailyHours: "Moyenne d'heures par jour",
  filterAll: "Tout",
  filterPending: "En attente",
  filterJustified: "Justifiées",
  filterUnjustified: "Non justifiées",
  filterToday: "Aujourd'hui",
  filterThisWeek: "Cette semaine",
  filterThisMonth: "Ce mois",
  fromDateLabel: "Date de début",
  toDateLabel: "Date de fin",
  applyFilters: "Appliquer les filtres",
  resetFilters: "Réinitialiser",
  noAbsencesMessage: "Aucune absence trouvée pour la période sélectionnée.",
  markSuccess: "Absence enregistrée avec succès",
  voidSuccess: "Absence annulée avec succès",
  filterSuccess: "Filtres appliqués",
  voidAbsenceTitle: "Annuler l'absence",
  voidAbsenceDesc: "Êtes-vous sûr de vouloir annuler cette absence ?",
  voidAbsenceSuccess: "Absence annulée avec succès",
  lateSuffix: " minutes de retard"
};

fs.writeFileSync(frPath, JSON.stringify(fr, null, 2));
console.log('absences section added. Root keys:', Object.keys(fr).length);
