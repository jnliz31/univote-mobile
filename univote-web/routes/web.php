<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\ResultController;
use App\Http\Controllers\Admin\ElectionController;
use App\Http\Controllers\Auth\AdminAuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\VoterController as AdminVoterController;
use App\Http\Controllers\Admin\OrganizationController;
use App\Http\Controllers\Admin\ProfileController;

/*
|--------------------------------------------------------------------------
| Guest Routes (Landing & Login Pages)
|--------------------------------------------------------------------------
*/

// Landing page - serve SPA
Route::get('/', function () {
    return view('index');
});

/*
|--------------------------------------------------------------------------
| Admin Authentication Routes
|--------------------------------------------------------------------------
*/

Route::prefix('admin')->group(function () {
    // Auth check (always available)
    Route::get('auth/check', [AdminAuthController::class, 'check'])->name('admin.auth.check');

    // Guest routes (not logged in)
    Route::middleware('guest:admin')->group(function () {
        Route::get('login', [AdminAuthController::class, 'showLogin'])->name('admin.login');
        Route::post('login', [AdminAuthController::class, 'login']);
    });

    // Authenticated routes (logged in)
    Route::middleware('auth:admin')->group(function () {
        Route::post('logout', [AdminAuthController::class, 'logout'])->name('admin.logout');
    });
});

/*
|--------------------------------------------------------------------------
| Admin Protected Routes
|--------------------------------------------------------------------------
*/

Route::prefix('admin')->middleware('auth:admin')->group(function () {
    // Dashboard
    Route::get('dashboard', [DashboardController::class, 'index'])->name('admin.dashboard');

    // Elections Management
    Route::controller(ElectionController::class)->group(function () {
        Route::get('elections', 'index')->name('admin.elections.index');
        Route::get('elections/create', 'create')->name('admin.elections.create');
        Route::post('elections', 'store')->name('admin.elections.store');
        Route::get('elections/{election}/edit', 'edit')->name('admin.elections.edit');
        Route::put('elections/{election}', 'update')->name('admin.elections.update');
        Route::post('elections/{election}/end', 'endElection')->name('admin.elections.end');
        Route::delete('elections/{election}', 'destroy')->name('admin.elections.destroy');
    });

    // Voters Management
    Route::controller(AdminVoterController::class)->group(function () {
        Route::get('voters', 'index')->name('admin.voters.index');
        Route::put('voters/{voter}', 'update')->name('admin.voters.update');
        Route::delete('voters/{voter}', 'destroy')->name('admin.voters.destroy');
    });

    // Organizations Management
    Route::controller(OrganizationController::class)->group(function () {
        Route::get('organizations', 'index')->name('admin.organizations.index');
        Route::post('organizations', 'store')->name('admin.organizations.store');
        Route::put('organizations/{organization}', 'update')->name('admin.organizations.update');
        Route::delete('organizations/{organization}', 'destroy')->name('admin.organizations.destroy');
    });

    // Results
    Route::controller(ResultController::class)->group(function () {
        Route::get('results', 'index')->name('admin.results.index');
        Route::get('results/{election}', 'show')->name('admin.results.show');
    });

    // Announcements
    Route::controller(AnnouncementController::class)->group(function () {
        Route::get('announcements', 'index')->name('admin.announcements.index');
        Route::post('announcements', 'store')->name('admin.announcements.store');
        Route::get('announcements/{announcement}/edit', 'edit')->name('admin.announcements.edit');
        Route::put('announcements/{announcement}', 'update')->name('admin.announcements.update');
        Route::delete('announcements/{announcement}', 'destroy')->name('admin.announcements.destroy');
    });

    // Audit Logs Management
    Route::controller(\App\Http\Controllers\Admin\AuditLogController::class)->group(function () {
        Route::get('audit-logs', 'index')->name('admin.audit-logs.index');
        Route::get('audit-logs/{id}', 'show')->name('admin.audit-logs.show');
    });

    // Admin Profile
    Route::controller(ProfileController::class)->group(function () {
        Route::get('profile', 'show')->name('admin.profile.show');
        Route::put('profile', 'update')->name('admin.profile.update');
        Route::put('profile/password', 'updatePassword')->name('admin.profile.password');
        Route::post('profile/picture', 'updateProfilePicture')->name('admin.profile.picture');
    });
});

/*
|--------------------------------------------------------------------------
| SPA Catch-All Route  (must be last)
|--------------------------------------------------------------------------
*/
// Serve Vue SPA for all unmatched routes
Route::fallback(function () {
    return view('index');
});
