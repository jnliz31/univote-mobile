<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ElectionController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\VoteController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\FacialVerificationController;
use App\Http\Controllers\Api\OrganizationController;

// Health check endpoint (no authentication required)
Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'message' => 'API is running']);
});

// One-time admin bootstrap. Disabled unless BOOTSTRAP_TOKEN is set in the
// environment. Set the token on Render, call this once to create/reset an admin,
// then remove BOOTSTRAP_TOKEN so the endpoint becomes unavailable again.
Route::match(['get', 'post'], '/bootstrap/admin', function (\Illuminate\Http\Request $request) {
    $configured = (string) config('services.bootstrap_token');

    if ($configured === '') {
        abort(404);
    }

    $provided = (string) ($request->header('X-Bootstrap-Token') ?: $request->input('token', ''));

    if (!hash_equals($configured, $provided)) {
        abort(403, 'Invalid bootstrap token.');
    }

    $data = $request->validate([
        'email' => 'required|email',
        'password' => 'required|string|min:8',
        'name' => 'nullable|string|max:255',
    ]);

    $admin = \App\Models\Admin::updateOrCreate(
        ['email' => $data['email']],
        [
            'name' => $data['name'] ?? 'Admin',
            'password' => \Illuminate\Support\Facades\Hash::make($data['password']),
        ]
    );

    return response()->json([
        'status' => 'success',
        'message' => "Admin [{$admin->email}] is ready. Remove BOOTSTRAP_TOKEN now to disable this endpoint.",
    ]);
});

// Public routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/auth/google', [AuthController::class, 'googleLogin']);
Route::get('/organizations', [OrganizationController::class, 'index']);

// Protected routes (require authentication)
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/auth/setup-profile', [AuthController::class, 'setupProfile']);
    Route::put('/auth/update-profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/update-profile-picture', [AuthController::class, 'updateProfilePicture']);
    Route::delete('/auth/remove-profile-picture', [AuthController::class, 'removeProfilePicture']);

    // Facial Verification routes
    Route::prefix('facial')->group(function () {
        Route::get('/config', [FacialVerificationController::class, 'getConfig']);
        Route::post('/detect-quality', [FacialVerificationController::class, 'detectQuality']);
        Route::post('/enroll', [FacialVerificationController::class, 'enroll']);
        Route::post('/verify', [FacialVerificationController::class, 'verify'])
            ->middleware('throttle:facial-verify');
        Route::post('/validate-session', [FacialVerificationController::class, 'validateSession']);
        Route::post('/reset-attempts', [FacialVerificationController::class, 'resetAttempts']);
        Route::post('/toggle', [FacialVerificationController::class, 'toggle']);
        Route::delete('/remove', [FacialVerificationController::class, 'remove']);
    });

    // Election routes
    Route::get('/elections', [ElectionController::class, 'index']);
    Route::get('/elections/{id}', [ElectionController::class, 'show']);
    Route::get('/elections/{id}/results', [ElectionController::class, 'results']);
    Route::post('/elections', [ElectionController::class, 'store']);
    Route::put('/elections/{id}', [ElectionController::class, 'update']);
    Route::delete('/elections/{id}', [ElectionController::class, 'destroy']);

    // Candidate routes
    Route::get('/candidates', [CandidateController::class, 'index']);
    Route::get('/candidates/{id}', [CandidateController::class, 'show']);
    Route::get('/elections/{electionId}/candidates', [CandidateController::class, 'byElection']);
    Route::post('/candidates', [CandidateController::class, 'store']);
    Route::put('/candidates/{id}', [CandidateController::class, 'update']);
    Route::delete('/candidates/{id}', [CandidateController::class, 'destroy']);

    // Vote routes
    Route::get('/votes', [VoteController::class, 'index']);
    Route::post('/votes', [VoteController::class, 'store']);
    Route::get('/elections/{electionId}/check-vote', [VoteController::class, 'checkVote']);

    // Announcement routes
    Route::get('/announcements', [AnnouncementController::class, 'index']);
    Route::post('/announcements', [AnnouncementController::class, 'store']);
    Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);

    // User routes (admin)
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
});

