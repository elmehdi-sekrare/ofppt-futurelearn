<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JustificationResource;
use App\Mail\JustificationReviewedMail;
use App\Mail\JustificationSubmittedMail;
use App\Models\Justification;
use App\Models\Notification;
use App\Models\User;
use App\Models\Absence;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class JustificationController extends Controller
{
    /** GET /api/justifications */
    public function index(Request $request)
    {
        $query = Justification::with(['absence.student.user', 'absence.group', 'reviewer']);

        $user = $request->user();
        if ($user->role === 'student') {
            $query->whereHas('absence', fn ($q) =>
                $q->where('student_id', $user->student->id)
            );
        } elseif ($user->role === 'teacher') {
            $query->whereHas('absence', fn ($q) =>
                $q->whereIn('group_id', $user->teacher->groups()->pluck('groups.id'))
            );
        }

        return JustificationResource::collection(
            $query->orderByDesc('submitted_at')->get()
        );
    }

    /** POST /api/justifications (multipart/form-data) */
    public function store(Request $request)
    {
        $data = $request->validate([
            'absence_id' => 'required|exists:absences,id',
            'reason'     => 'required|string',
            'file'       => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        $absence = Absence::with('justification')->findOrFail($data['absence_id']);
        if ($request->user()->role !== 'student' || !$request->user()->student || $absence->student_id !== $request->user()->student->id) {
            return response()->json(['message' => 'You can only justify your own absence.'], 403);
        }
        if ($absence->attendance_status !== 'absent') {
            return response()->json(['message' => 'Only an absence can be justified.'], 422);
        }
        if ($absence->justification) {
            return response()->json(['message' => 'A justification has already been submitted for this absence.'], 422);
        }

        $file = $request->file('file');
        $path = $file->store('justifications', 'public');

        $ext = strtolower($file->getClientOriginalExtension());
        $fileType = $ext === 'pdf' ? 'pdf' : 'image';

        $justification = Justification::create([
            'absence_id' => $data['absence_id'],
            'reason'     => $data['reason'],
            'file_name'  => $file->getClientOriginalName(),
            'file_path'  => $path,
            'file_type'  => $fileType,
            'file_size'  => $file->getSize(),
        ]);

        $justification->load(['absence.student.user', 'absence.group']);
        AuditLogger::record($request->user(), 'justification.submitted', $request->user()->first_name . ' submitted a justification.', $justification, ['absence_id' => $absence->id]);

        // Send email notification to admin
        try {
            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                Mail::to($admin->email)
                    ->send(new JustificationSubmittedMail($justification));
            }
        } catch (\Throwable $e) {
            \Log::warning('Failed to send justification submitted email: ' . $e->getMessage());
        }

        return new JustificationResource($justification);
    }

    /** PATCH /api/justifications/{id}/approve */
    public function approve(Request $request, Justification $justification)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        if ($justification->status !== 'pending') return response()->json(['message' => 'This justification has already been reviewed.'], 422);
        if ($justification->absence->status === 'voided') return response()->json(['message' => 'A removed absence cannot be approved.'], 422);
        $data = $request->validate(['review_note' => 'nullable|string|max:300']);
        $justification->update([
            'status'      => 'approved',
            'reviewed_by' => $request->user()->id,
            'review_note' => $data['review_note'] ?? null,
            'reviewed_at' => now(),
        ]);

        // Also update the absence status
        $justification->absence->update([
            'status' => 'justified',
            'resolution_source' => 'student',
            'resolution_note' => $justification->reason,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $absence = $justification->absence;
        $note = $justification->review_note ? ' Note: ' . $justification->review_note : '';

        // In-app notification for the student
        Notification::create([
            'user_id' => $absence->student->user_id,
            'title'   => 'Justification approved',
            'message' => 'Your justification for the absence on ' . $absence->date
                . ' (' . $absence->subject . ') was approved. The absence is now marked as justified.' . $note,
            'type'    => 'success',
        ]);

        // Send email to student
        try {
            Mail::to($justification->absence->student->user->email)
                ->send(new JustificationReviewedMail($justification, 'approved'));
        } catch (\Throwable $e) {
            \Log::warning('Failed to send justification email: ' . $e->getMessage());
        }

        $justification->load(['absence.student.user', 'reviewer']);
        AuditLogger::record($request->user(), 'justification.approved', $request->user()->first_name . ' approved a justification.', $justification, ['absence_id' => $justification->absence_id]);
        return new JustificationResource($justification);
    }

    /** PATCH /api/justifications/{id}/reject */
    public function reject(Request $request, Justification $justification)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        if ($justification->status !== 'pending') return response()->json(['message' => 'This justification has already been reviewed.'], 422);
        if ($justification->absence->status === 'voided') return response()->json(['message' => 'A removed absence cannot be rejected.'], 422);
        $data = $request->validate(['review_note' => 'required|string|max:300']);
        $justification->update([
            'status'      => 'rejected',
            'reviewed_by' => $request->user()->id,
            'review_note' => $data['review_note'],
            'reviewed_at' => now(),
        ]);

        $justification->absence->update([
            'status' => 'unjustified',
            'resolution_source' => 'student',
            'resolution_note' => $justification->review_note,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $absence = $justification->absence;
        $note = $justification->review_note ? ' Note: ' . $justification->review_note : '';

        // In-app notification for the student
        Notification::create([
            'user_id' => $absence->student->user_id,
            'title'   => 'Justification rejected',
            'message' => 'Your justification for the absence on ' . $absence->date
                . ' (' . $absence->subject . ') was rejected. The absence remains unjustified.' . $note,
            'type'    => 'error',
        ]);

        // Send email to student
        try {
            Mail::to($justification->absence->student->user->email)
                ->send(new JustificationReviewedMail($justification, 'rejected'));
        } catch (\Throwable $e) {
            \Log::warning('Failed to send justification email: ' . $e->getMessage());
        }

        $justification->load(['absence.student.user', 'reviewer']);
        AuditLogger::record($request->user(), 'justification.rejected', $request->user()->first_name . ' rejected a justification.', $justification, ['absence_id' => $justification->absence_id]);
        return new JustificationResource($justification);
    }
}
