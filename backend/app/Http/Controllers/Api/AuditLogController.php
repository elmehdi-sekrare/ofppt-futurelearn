<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);

        $query = AuditLog::with('actor')->latest();
        if ($request->filled('event')) $query->where('event', $request->string('event'));
        return AuditLogResource::collection($query->limit(min((int) $request->input('limit', 100), 250))->get());
    }
}
