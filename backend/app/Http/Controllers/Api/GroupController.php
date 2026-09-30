<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GroupResource;
use App\Http\Resources\StudentResource;
use App\Models\Group;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    /** GET /api/groups */
    public function index()
    {
        $user = request()->user();

        if ($user->role === 'teacher') {
            $groups = $user->teacher->groups()->where('groups.status', 'active')->withCount(['students', 'teachers'])->get();
        } elseif ($user->role === 'student') {
            $groups = Group::withCount(['students', 'teachers'])->where('id', $user->student->group_id)->where('status', 'active')->get();
        } else {
            // Absence totals let the admin compare groups without opening each one.
            $absent = fn ($q) => $q->where('attendance_status', 'absent')->where('status', '!=', 'voided');
            $groups = Group::withCount(['students', 'teachers', 'absences as absence_count' => $absent])
                ->withSum(['absences as absence_hours' => $absent], 'hours')
                ->withMax('absences as last_session_date', 'date')
                ->get();
        }

        return GroupResource::collection($groups);
    }

    /** POST /api/groups */
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name'  => 'required|string|max:50|unique:groups,name',
            'level' => 'required|string|max:50',
            'degree' => 'nullable|string|max:80',
            'study_year' => 'nullable|string|max:30',
            'academic_year' => 'nullable|string|max:20',
            'status' => 'sometimes|in:active,archived',
        ]);

        return new GroupResource(Group::create($data));
    }

    /** PUT /api/groups/{id} */
    public function update(Request $request, Group $group)
    {
        if (!$this->canManage($request, $group)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name'  => 'sometimes|string|max:50|unique:groups,name,' . $group->id,
            'level' => 'sometimes|string|max:50',
            'degree' => 'sometimes|string|max:80',
            'study_year' => 'nullable|string|max:30',
            'academic_year' => 'nullable|string|max:20',
            'status' => 'sometimes|in:active,archived',
        ]);

        DB::transaction(function () use ($group, $data) {
            if (($data['status'] ?? $group->status) === 'archived') $group->teachers()->detach();
            $group->update($data);
        });
        return new GroupResource($group);
    }

    /** DELETE /api/groups/{id} */
    public function destroy(Group $group)
    {
        if (!$this->canManage(request(), $group)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        DB::transaction(function () use ($group) {
            $group->teachers()->detach();
            $group->update(['status' => 'archived']);
        });
        return response()->noContent();
    }

    /** DELETE /api/groups-bulk */
    public function bulkDestroy(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'group_ids' => 'required|array|min:1',
            'group_ids.*' => 'integer|distinct|exists:groups,id',
            'action' => 'required|in:archive,restore,delete',
        ]);

        if ($data['action'] === 'delete') {
            $groups = Group::withCount(['students', 'absences'])->whereIn('id', $data['group_ids'])->get();

            // Attendance history is the one thing we will not destroy: absences
            // reference the group with restrictOnDelete, and losing them would
            // erase the record a student's file is built on. Students themselves
            // are only detached — they keep their account and their other groups.
            $withHistory = $groups->first(fn (Group $group) => $group->absences_count > 0);
            if ($withHistory) {
                return response()->json([
                    'message' => "Group {$withHistory->name} still holds {$withHistory->absences_count} attendance records and cannot be deleted. Archiving keeps the group out of the way without losing that history.",
                ], 422);
            }

            // A student whose only group is this one would be left dangling,
            // because students.group_id cannot be null.
            $stranded = $groups->first(function (Group $group) {
                return $group->students()
                    ->whereDoesntHave('groups', fn ($query) => $query->whereKeyNot($group->id))
                    ->exists();
            });
            if ($stranded) {
                return response()->json([
                    'message' => "Group {$stranded->name} cannot be deleted because some trainees belong to no other group. Move them to another group first, or delete those trainees.",
                ], 422);
            }

            $deleted = DB::transaction(function () use ($groups) {
                foreach ($groups as $group) {
                    $group->teachers()->detach();

                    // Re-home each student on one of their remaining groups
                    // before dropping the membership rows.
                    foreach ($group->students()->with('groups')->get() as $student) {
                        $fallback = $student->groups->firstWhere('id', '!=', $group->id);
                        if ($fallback) {
                            $student->update(['group_id' => $fallback->id]);
                        }
                    }

                    $group->students()->detach();
                    $group->delete();
                }

                return $groups->count();
            });

            return response()->json(['data' => ['deleted' => $deleted]]);
        }

        $status = $data['action'] === 'restore' ? 'active' : 'archived';
        $updated = DB::transaction(function () use ($data, $status) {
            $groups = Group::whereIn('id', $data['group_ids'])->get();
            if ($status === 'archived') {
                foreach ($groups as $group) $group->teachers()->detach();
            }
            return Group::whereIn('id', $data['group_ids'])->update(['status' => $status]);
        });
        return response()->json(['data' => [$data['action'] === 'restore' ? 'restored' : 'archived' => $updated]]);
    }

    /** GET /api/groups/{id}/students */
    public function students(Group $group)
    {
        $user = request()->user();
        if ($group->status !== 'active' && $user->role !== 'admin') {
            return response()->json(['message' => 'This group is archived.'], 403);
        }
        if ($user->role === 'teacher' && !$user->teacher->groups->contains($group->id)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->role === 'student' && $user->student->group_id !== $group->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $students = $group->students()->with(['user', 'group', 'groups'])->withAttendanceTotals()->get();
        return StudentResource::collection($students);
    }

    private function canManage(Request $request, Group $group): bool
    {
        $user = $request->user();
        if ($user->role === 'admin') return true;

        return false;
    }
}
