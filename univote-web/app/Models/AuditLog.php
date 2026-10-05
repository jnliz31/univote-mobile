<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $fillable = [
        'user_id',
        'user_type',
        'actor_name',
        'action',
        'model_type',
        'model_id',
        'old_values',
        'new_values',
        'entity_type',
        'entity_id',
        'description',
        'metadata',
        'ip_address',
        'user_agent',
        'platform',
        'severity',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'metadata'   => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Determine platform ('Mobile App' vs 'Web Browser') from User-Agent string or headers.
     */
    public static function detectPlatform(?string $userAgent = null): string
    {
        $agent = $userAgent ?? Request::userAgent() ?? '';
        $headerPlatform = Request::header('X-Client-Platform');

        if (strcasecmp($headerPlatform ?? '', 'mobile') === 0 || strcasecmp($headerPlatform ?? '', 'mobile_app') === 0) {
            return 'Mobile App';
        }

        // Common mobile client agents (Expo, React Native, OkHttp, Android, iOS app wrappers)
        if (
            preg_match('/(okhttp|Expo|ReactNative|UnivoteMobile|CFNetwork|Dalvik|Android.*Mobile|iPhone.*App)/i', $agent) &&
            !preg_match('/(Chrome|Safari|Firefox|Edge|Opera)\/[0-9]/i', $agent)
        ) {
            return 'Mobile App';
        }

        if (preg_match('/(okhttp|Expo|ReactNative|UnivoteMobile)/i', $agent)) {
            return 'Mobile App';
        }

        return 'Web Browser';
    }

    /**
     * Helper to log custom system or auth audit events
     */
    public static function record(array $data): self
    {
        $request = request();
        $user = Auth::user() ?? Auth::guard('admin')->user() ?? Auth::guard('sanctum')->user();

        $userId = $data['user_id'] ?? ($user ? $user->id : null);
        $userType = $data['user_type'] ?? ($user ? get_class($user) : null);
        
        $actorName = $data['actor_name'] ?? null;
        if (!$actorName && $user) {
            $actorName = $user->name ?? $user->email ?? ("User #" . $user->id);
        }

        $userAgent = $data['user_agent'] ?? $request->userAgent();
        $platform = $data['platform'] ?? self::detectPlatform($userAgent);

        $action = $data['action'] ?? 'SYSTEM_EVENT';
        $description = $data['description'] ?? ($action . ' performed');

        return self::create([
            'user_id'     => $userId,
            'user_type'   => $userType,
            'actor_name'  => $actorName,
            'action'      => $action,
            'model_type'  => $data['model_type'] ?? null,
            'model_id'    => $data['model_id'] ?? null,
            'old_values'  => $data['old_values'] ?? null,
            'new_values'  => $data['new_values'] ?? null,
            'description' => $description,
            'ip_address'  => $data['ip_address'] ?? $request->ip(),
            'user_agent'  => $userAgent,
            'platform'    => $platform,
            'severity'    => $data['severity'] ?? 'info',
        ]);
    }
}
