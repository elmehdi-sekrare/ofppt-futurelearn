<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Module;
use Illuminate\Http\Request;

class ModuleController extends Controller
{
    public function index(Request $request)
    {
        if ($request->user()->role !== 'teacher' || !$request->user()->teacher) return response()->json(['message' => 'Forbidden'], 403);
        return response()->json(['data' => $request->user()->teacher->modules()->orderBy('name')->get()]);
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'teacher' || !$request->user()->teacher) return response()->json(['message' => 'Forbidden'], 403);
        $data = $request->validate(['name' => 'required|string|max:100']);
        $module = $request->user()->teacher->modules()->create(['name' => trim($data['name'])]);
        return response()->json(['data' => $module], 201);
    }

    public function update(Request $request, Module $module)
    {
        if (!$this->owns($request, $module)) return response()->json(['message' => 'Forbidden'], 403);
        $data = $request->validate(['name' => 'required|string|max:100']);
        $module->update(['name' => trim($data['name'])]);
        return response()->json(['data' => $module]);
    }

    public function destroy(Request $request, Module $module)
    {
        if (!$this->owns($request, $module)) return response()->json(['message' => 'Forbidden'], 403);
        $module->delete();
        return response()->noContent();
    }

    private function owns(Request $request, Module $module): bool
    {
        return $request->user()->role === 'teacher'
            && $request->user()->teacher
            && (int) $module->teacher_id === (int) $request->user()->teacher->id;
    }
}
