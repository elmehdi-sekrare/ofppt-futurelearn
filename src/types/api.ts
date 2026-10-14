// API response wrappers
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// Auth
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  profile_image?: string | null;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
  must_change_password?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Domain models (matching MySQL schema)
export interface Student {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  cne: string;
  phone: string;
  group_id: number;
  group_name: string;
  /** Every group the student belongs to; group_name is the primary one. */
  group_names?: string[];
  total_absence_hours: number;
  late_count?: number;
}

export interface Teacher {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  subjects?: string[];
  phone?: string;
  groups_assigned: string[];
  group_ids?: number[];
}

export interface Group {
  id: number;
  name: string;
  level: string;
  degree?: string | null;
  study_year?: string | null;
  academic_year?: string | null;
  status?: "active" | "archived";
  student_count: number;
  teacher_count?: number;
  /** Admin listing only: non-voided absences recorded for the group. */
  absence_count?: number;
  absence_hours?: number;
  last_session_date?: string | null;
}

export interface CourseModule {
  id: number;
  teacher_id: number;
  name: string;
  created_at?: string;
}

export type ImportRowStatus = "new" | "invalid" | "duplicate_allowed" | "duplicate_locked" | "duplicate";

export interface StudentImportRow {
  index: number;
  source_row: number;
  first_name: string;
  last_name: string;
  cne: string;
  status: ImportRowStatus;
  message?: string | null;
  existing_student_id?: number | null;
}

export interface ModuleImportRow {
  index: number;
  source_row: number;
  name: string;
  status: ImportRowStatus;
  message?: string | null;
}

export interface ImportPreview<T> {
  batch_id: number;
  rows: T[];
  expires_at: string;
}

export interface StudentStats {
  student: Student;
  absence_hours: number;
  justified_hours: number;
  unjustified_hours: number;
  pending_hours: number;
  absence_count: number;
  late_count: number;
  late_minutes: number;
  session_count: number;
  attendance_rate: number;
  threshold_hours: number;
  monthly: { month: string; label: string; hours: number }[];
  worst_weekday?: string | null;
  recent: {
    id: number;
    date: string;
    hours: number;
    attendance_status: AttendanceStatus;
    status: Absence["status"];
    late_minutes: number;
    group_name: string;
    subject: string;
    start_time: string;
    end_time: string;
    teacher_name: string;
  }[];
}

export interface HeatmapCell {
  date: string;
  hours: number;
  count: number;
  future: boolean;
}

export interface HeatmapWeek {
  week: string;
  week_start: string;
  days: HeatmapCell[];
}

export interface HeatmapData {
  weeks: HeatmapWeek[];
  peak_hours: number;
  range_start: string;
  range_end: string;
  anchored_on_data: boolean;
}

export type RiskLevel = "critical" | "high" | "watch" | "ok";

export interface InsightStudent {
  student_id: number;
  student_name: string;
  group_name: string;
  score: number;
  level: RiskLevel;
  absent_hours: number;
  unjustified_hours: number;
  absence_count: number;
  late_count: number;
  sessions: number;
  absence_rate: number;
  reasons: { key: "rate" | "unjustified" | "late"; value: number }[];
}

export interface InsightPattern {
  student_id: number;
  student_name: string;
  group_name: string;
  day_index: number;
  count: number;
  total: number;
  share: number;
  severity: "critical" | "warning" | "info";
}

export interface DashboardInsights {
  has_data: boolean;
  students: InsightStudent[];
  patterns: InsightPattern[];
  weekday_totals: number[];
  cohort: { sessions: number; absent_hours: number; absence_rate: number };
}

// ── Trainer import (assignment workbook) ─────────────────────────────
export interface TeacherImportTrainer {
  index: number;
  /** The name exactly as written in the workbook. */
  source_name: string;
  first_name: string;
  last_name: string;
  /** The first/last split was a guess and is worth a second look. */
  name_check: boolean;
  status: "new" | "existing";
  existing_teacher_id: number | null;
  existing_email: string | null;
  modules: { name: string; code: string | null }[];
  groups: string[];
  rows: number;
}

export interface TeacherImportGroup {
  name: string;
  degree: string | null;
  study_year: string | null;
  filiere: string | null;
  trainer_count: number;
  status: "new" | "existing" | "archived";
  existing_group_id: number | null;
}

export interface TeacherImportPreview {
  batch_id: number;
  expires_at: string;
  sheet: string;
  academic_year: string;
  rows: number;
  skipped: { unassigned: number; missing_group: number; missing_module: number };
  trainers: TeacherImportTrainer[];
  groups: TeacherImportGroup[];
}

export interface TeacherImportResult {
  created: number;
  linked: number;
  skipped: number;
  groups_created: number;
  groups_reused: number;
  groups_archived: string[];
  modules_created: number;
  group_links: number;
  credentials: { name: string; email: string; temporary_password: string }[];
}

// ── Student list import (institution export, groups mixed) ──────────
export interface StudentListImportStudent {
  index: number;
  source_row: number;
  first_name: string;
  last_name: string;
  cin: string;
  matricule: string;
  /** Identifier stored for the student: the CIN, or the matricule when there is none. */
  cne: string;
  /** Key of the student's group in `groups`. */
  group: string;
  /** "existing" joins the group from the file; "unchanged" is already in it. */
  status: "new" | "existing" | "unchanged";
  existing_student_id: number | null;
  current_groups: string[];
}

export interface StudentListImportGroup {
  key: string;
  name: string;
  degree: string | null;
  study_year: string | null;
  academic_year: string | null;
  filiere: string | null;
  student_count: number;
  new_students: number;
  existing_students: number;
  unchanged_students: number;
  status: "new" | "existing" | "archived";
  existing_group_id: number | null;
}

export type StudentListSkipReason = "inactive" | "missing_group" | "invalid_group" | "missing_name" | "missing_identifier" | "duplicate";

export interface StudentListImportPreview {
  batch_id: number;
  expires_at: string;
  sheet: string;
  academic_year: string;
  rows: number;
  students: StudentListImportStudent[];
  groups: StudentListImportGroup[];
  skipped: { source_row: number; name: string; group: string; reason: StudentListSkipReason }[];
}

export interface StudentListImportResult {
  students_created: number;
  students_added: number;
  students_unchanged: number;
  skipped: number;
  groups_created: number;
  groups_reused: number;
  groups_archived: string[];
  credentials: { name: string; group: string; email: string; temporary_password: string }[];
}

export interface Absence {
  id: number;
  student_id: number;
  student_name: string;
  group_name: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  subject: string;
  teacher_name: string;
  notes: string;
  status: "pending" | "justified" | "unjustified" | "voided";
  attendance_status: AttendanceStatus;
  late_minutes: number;
  resolution_source?: "student" | "admin" | "teacher" | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
}

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface Justification {
  id: number;
  absence_id: number;
  student_name: string;
  date: string;
  hours: number;
  reason: string;
  file_name: string;
  file_path?: string | null;
  file_type: "pdf" | "image";
  submitted_at: string;
  status: "pending" | "approved" | "rejected";
  review_note?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface RiskStudent {
  student_id: number;
  student_name: string;
  group_name: string;
  risk_level: "none" | "low" | "medium" | "high";
  absence_hours: number;
  unexcused_hours: number;
  absence_count: number;
  late_count: number;
  recent_absence_count: number;
  recent_late_count: number;
  pending_justifications: number;
  factors: string[];
  factor_codes: { key: "unexcused_hours" | "recent_absences" | "recent_lates" | "pending"; value: number }[];
  sessions: number;
  recent_absence_hours: number;
  last_absence_date: string | null;
  /** Cohort-relative 0-100 vigilance score, same formula as the dashboard. */
  score: number;
}

export interface AuditLog {
  id: number;
  event: string;
  description: string;
  actor_name: string;
  actor_role?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  total_students?: number;
  total_teachers?: number;
  absence_rate?: number;
  pending_reviews?: number;
  high_risk_students?: number;
  late_count?: number;
  my_groups?: number;
  my_students?: number;
  today_absences?: number;
  today_late?: number;
  absence_hours?: number;
  pending_justifications?: number;
  unjustified_count?: number;
  attendance_rate?: number;
  justified_hours?: number;
  unjustified_hours?: number;
  pending_hours?: number;
}

// Request payloads
export interface CreateStudentPayload {
  first_name: string;
  last_name: string;
  cne: string;
  phone: string;
  group_id: number;
}

export interface CreateTeacherPayload {
  first_name: string;
  last_name: string;
  subject?: string;
  phone?: string;
  group_ids?: number[];
}

export interface CreateGroupPayload {
  name: string;
  level: string;
  degree?: string;
  study_year?: string;
  academic_year?: string;
  status?: "active" | "archived";
}

export interface CreateAbsencePayload {
  student_ids?: number[];
  attendance_records?: { student_id: number; attendance_status: AttendanceStatus; late_minutes?: number }[];
  group_id: number;
  module_id: number;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface AbsenceFilters {
  student_id?: number;
  group?: string;
  status?: string;
  attendance_status?: string;
  date?: string;
  search?: string;
  teacher_id?: string;
  limit?: number;
  sort?: string;
}
