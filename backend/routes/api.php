<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\TeacherController;
use App\Http\Controllers\Api\GroupController;
use App\Http\Controllers\Api\AbsenceController;
use App\Http\Controllers\Api\JustificationController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\ModuleController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Temporary: check mail config
Route::get('/mail-check', function () {
    return response()->json([
        'mailer' => config('mail.default'),
        'from_address' => config('mail.from.address'),
        'from_name' => config('mail.from.name'),
        'resend_key_exists' => !empty(config('services.resend.key')),
    ]);
});

// Authenticated
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::match(['patch', 'post'], '/me/profile', [AuthController::class, 'updateProfile']);
    Route::patch('/me/change-password', [AuthController::class, 'changePassword']);

    // Dashboard
    Route::get('/dashboard/admin', [DashboardController::class, 'admin']);
    Route::get('/dashboard/teacher', [DashboardController::class, 'teacher']);
    Route::get('/dashboard/student', [DashboardController::class, 'student']);
    Route::get('/dashboard/chart', [DashboardController::class, 'chart']);
    Route::get('/dashboard/heatmap', [DashboardController::class, 'heatmap']);
    Route::get('/dashboard/risk', [DashboardController::class, 'risk']);
    Route::get('/dashboard/insights', [DashboardController::class, 'insights']);

    // CRUD resources
    Route::delete('/students-bulk', [StudentController::class, 'bulkDestroy']);
    Route::get('/students/{student}/stats', [StudentController::class, 'stats']);
    Route::apiResource('students', StudentController::class);
    Route::apiResource('teachers', TeacherController::class);
    Route::delete('/groups-bulk', [GroupController::class, 'bulkDestroy']);
    Route::apiResource('groups', GroupController::class);
    Route::get('/groups/{group}/students', [GroupController::class, 'students']);
    Route::post('/groups/{group}/student-imports/preview', [ImportController::class, 'previewStudents']);
    Route::post('/student-imports/{batch}/commit', [ImportController::class, 'commitStudents']);
    Route::post('/teacher-imports/preview', [ImportController::class, 'previewTeachers']);
    Route::post('/teacher-imports/{batch}/commit', [ImportController::class, 'commitTeachers']);
    Route::post('/student-list-imports/preview', [ImportController::class, 'previewStudentList']);
    Route::post('/student-list-imports/{batch}/commit', [ImportController::class, 'commitStudentList']);

    // Teacher modules and module imports
    Route::apiResource('modules', ModuleController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::post('/module-imports/preview', [ImportController::class, 'previewModules']);
    Route::post('/module-imports/{batch}/commit', [ImportController::class, 'commitModules']);

    // Absences
    Route::get('/absences/student-history/{student}', [AbsenceController::class, 'studentHistory']);
    Route::get('/absences', [AbsenceController::class, 'index']);
    Route::post('/absences', [AbsenceController::class, 'store']);
    Route::patch('/absences/{absence}/resolve', [AbsenceController::class, 'resolve']);
    Route::delete('/absences/{absence}', [AbsenceController::class, 'destroy']);

    // Justifications
    Route::get('/justifications', [JustificationController::class, 'index']);
    Route::post('/justifications', [JustificationController::class, 'store']);
    Route::patch('/justifications/{justification}/approve', [JustificationController::class, 'approve']);
    Route::patch('/justifications/{justification}/reject', [JustificationController::class, 'reject']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/clear', [NotificationController::class, 'clear']);

    // Administration audit trail
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
});

