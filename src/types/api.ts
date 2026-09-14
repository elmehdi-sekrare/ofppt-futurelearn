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
