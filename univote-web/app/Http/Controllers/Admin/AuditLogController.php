<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->expectsJson()) {
            return view('index');
        }

        $query = AuditLog::query()->orderBy('created_at', 'desc');

        // Search by actor, action, model_type, or IP
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('actor_name', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%")
                  ->orWhere('model_type', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Platform filter
        if ($platform = $request->input('platform')) {
            $query->where('platform', $platform);
        }

        // Action filter
        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }

        // Date range filter
        if ($startDate = $request->input('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate = $request->input('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $logs = $query->paginate($perPage);

        // Stats summary
        $totalLogs = AuditLog::count();
        $mobileLogsCount = AuditLog::where('platform', 'Mobile App')->count();
        $webLogsCount = AuditLog::where('platform', 'Web Browser')->count();
        $voteCastCount = AuditLog::where('action', 'VOTE_CAST')->count();

        // Available actions for filtering dropdown
        $availableActions = AuditLog::distinct()->pluck('action')->filter()->values();

        return response()->json([
            'logs' => $logs,
            'summary' => [
                'total' => $totalLogs,
                'mobile' => $mobileLogsCount,
                'web' => $webLogsCount,
                'votes_cast' => $voteCastCount,
            ],
            'available_actions' => $availableActions,
        ]);
    }

    public function show(Request $request, $id)
    {
        $log = AuditLog::findOrFail($id);

        if (!$request->expectsJson()) {
            return view('index');
        }

        return response()->json(['log' => $log]);
    }
}
