<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate limiter for facial verification endpoints (anti-spoofing)
        RateLimiter::for('facial-verify', function (Request $request) {
            return Limit::perMinute(6)->by($request->user()?->id ?: $request->ip());
        });

        // Register Audit Observer for central audit logging across Web and Mobile API
        $auditObserver = \App\Observers\AuditObserver::class;
        \App\Models\Election::observe($auditObserver);
        \App\Models\Candidate::observe($auditObserver);
        \App\Models\Voter::observe($auditObserver);
        \App\Models\Vote::observe($auditObserver);
        \App\Models\Position::observe($auditObserver);
        \App\Models\Announcement::observe($auditObserver);
        \App\Models\Organization::observe($auditObserver);
    }
}
