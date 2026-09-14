-- ============================================
-- OFPPT Smart Attendance - Demo Seeders
-- Password for all users: password123
-- ============================================

INSERT INTO `users` (`first_name`, `last_name`, `email`, `password`, `role`) VALUES
('Admin', 'OFPPT', 'admin@ofppt.ma', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('Prof', 'Amrani', 'teacher@ofppt.ma', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher'),
('Ahmed', 'Benali', 'student@ofppt.ma', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student');

INSERT INTO `groups` (`name`, `level`) VALUES
('DEV-201', '2eme Annee'),
('DEV-202', '2eme Annee'),
('GE-102', '1ere Annee'),
('ID-301', '3eme Annee');

INSERT INTO `teachers` (`user_id`) VALUES
(2);

INSERT INTO `students` (`user_id`, `cne`, `phone`, `group_id`) VALUES
(3, 'R130456789', '0612345678', 1);

INSERT INTO `group_students` (`group_id`, `student_id`) VALUES
(1, 1);

INSERT INTO `teacher_groups` (`teacher_id`, `group_id`) VALUES
(1, 1), (1, 2);
