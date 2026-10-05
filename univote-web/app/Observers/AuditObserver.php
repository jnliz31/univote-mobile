<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AuditObserver
{
    /**
     * Handle the Model "created" event.
     */
    public function created(Model $model): void
    {
        $action = $this->determineActionName($model, 'CREATE');
        $newValues = $this->filterAttributes($model->getAttributes());

        AuditLog::record([
            'action'     => $action,
            'model_type' => get_class($model),
            'model_id'   => $model->getKey(),
            'old_values' => null,
            'new_values' => $newValues,
        ]);
    }

    /**
     * Handle the Model "updated" event.
     */
    public function updated(Model $model): void
    {
        // Don't log if audit log itself or if no changes
        if ($model instanceof AuditLog) {
            return;
        }

        $changes = $model->getChanges();
        // Ignore updated_at column changes if that's the only change
        unset($changes['updated_at']);
        if (empty($changes)) {
            return;
        }

        $action = $this->determineActionName($model, 'UPDATE');
        $oldValues = $this->filterAttributes(array_intersect_key($model->getOriginal(), $changes));
        $newValues = $this->filterAttributes($changes);

        AuditLog::record([
            'action'     => $action,
            'model_type' => get_class($model),
            'model_id'   => $model->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
        ]);
    }

    /**
     * Handle the Model "deleting" event (captures values prior to actual deletion).
     */
    public function deleting(Model $model): void
    {
        if ($model instanceof AuditLog) {
            return;
        }

        $action = $this->determineActionName($model, 'DELETE');
        $oldValues = $this->filterAttributes($model->getAttributes());

        AuditLog::record([
            'action'     => $action,
            'model_type' => get_class($model),
            'model_id'   => $model->getKey(),
            'old_values' => $oldValues,
            'new_values' => null,
        ]);
    }

    /**
     * Determine specific action string per model type.
     */
    protected function determineActionName(Model $model, string $event): string
    {
        $classBasename = class_basename($model);

        // Specific requirements: Vote creation must be logged as VOTE_CAST
        if ($classBasename === 'Vote' && $event === 'CREATE') {
            return 'VOTE_CAST';
        }

        return strtoupper($event . '_' . Str::snake($classBasename));
    }

    /**
     * Filter out sensitive model attributes.
     */
    protected function filterAttributes(array $attributes): array
    {
        $sensitive = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'api_token'];

        foreach ($sensitive as $key) {
            if (isset($attributes[$key])) {
                $attributes[$key] = '[REDACTED]';
            }
        }

        return $attributes;
    }
}
