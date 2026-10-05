<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Voter;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'age' => 'required|integer|min:1|max:120',
            'sex' => 'required|string|max:30',
            'course' => 'required|string|max:255',
            'year_level' => 'required|string|max:50',
            'email' => 'required|string|email|max:255|unique:voters',
            'password' => 'required|string|min:6',
            'organization_id' => 'nullable|exists:organizations,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $voter = Voter::create([
            'name' => $request->name,
            'age' => $request->age,
            'sex' => $request->sex,
            'course' => $request->course,
            'year_level' => $request->year_level,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'organization_id' => $request->organization_id,
        ]);

        $token = $voter->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $voter->id,
                'name' => $voter->name,
                'email' => $voter->email,
                'role' => 'student',
            ],
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        // Try voter first
        $user = Voter::where('email', $request->email)->first();
        $role = 'student';

        // If not a voter, try admin
        if (!$user) {
            $user = Admin::where('email', $request->email)->first();
            $role = 'admin';
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            \App\Models\AuditLog::record([
                'user_id'    => null,
                'actor_name' => $request->email,
                'action'     => 'LOGIN_FAILED',
                'description'=> 'Failed login attempt via Mobile API',
                'severity'   => 'warning',
            ]);

            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('mobile-app')->plainTextToken;

        \App\Models\AuditLog::record([
            'user_id'    => $user->id,
            'user_type'  => get_class($user),
            'actor_name' => $user->name ?? $user->email,
            'action'     => 'LOGIN_SUCCESS',
            'description'=> 'User logged in via Mobile API',
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $role,
                'hasVoted' => $role === 'student' ? $user->hasVotedIn(null) : false,
            ],
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        if ($user) {
            \App\Models\AuditLog::record([
                'user_id'    => $user->id,
                'user_type'  => get_class($user),
                'actor_name' => $user->name ?? $user->email,
                'action'     => 'LOGOUT',
                'description'=> 'User logged out via Mobile API',
            ]);
            $user->currentAccessToken()->delete();
        }
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function user(Request $request)
    {
        $user = $request->user();
        $role = $user instanceof Admin ? 'admin' : 'student';

        $response = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role,
            'created_at' => $user->created_at,
        ];

        if ($role === 'student' && method_exists($user, 'load')) {
            $user->load('facialProfile');
            $response['facial_config'] = $user->facial_config;
            $response['facial_required'] = $user->isFacialVerificationRequired();
        }

        return response()->json($response);
    }

    public function googleLogin(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_token' => 'nullable|string',
            'email' => 'required_without:id_token|email',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $email = null;
        $name = $request->name;
        $googleId = $request->google_id;

        if ($request->filled('id_token')) {
            // Verify Google ID Token via Google's tokeninfo API
            $response = \Illuminate\Support\Facades\Http::get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $request->id_token,
            ]);

            if (!$response->successful()) {
                return response()->json(['error' => 'Invalid or expired Google ID token.'], 401);
            }

            $payload = $response->json();
            $email = strtolower($payload['email'] ?? '');
            $name = $payload['name'] ?? $name;
            $googleId = $payload['sub'] ?? $googleId;
        } else {
            $email = strtolower($request->email);
        }

        if (empty($email)) {
            return response()->json(['error' => 'Unable to determine email from Google account.'], 422);
        }

        // Strictly enforce ssct.edu.ph domain restriction (also support snsu.edu.ph if configured)
        $allowedDomains = array_map('trim', explode(',', strtolower(env('ALLOWED_GOOGLE_DOMAINS', 'ssct.edu.ph,snsu.edu.ph'))));
        $emailDomain = substr(strrchr($email, "@"), 1);

        if (!in_array($emailDomain, $allowedDomains)) {
            return response()->json([
                'error' => "Access Restricted: You must log in using an official @ssct.edu.ph Google account."
            ], 403);
        }

        // Find or create voter
        $voter = Voter::where('email', $email)->orWhere(function ($q) use ($googleId) {
            if ($googleId) $q->where('google_id', $googleId);
        })->first();

        $isNewUser = false;

        if (!$voter) {
            $isNewUser = true;
            $voter = Voter::create([
                'name' => $name ?: explode('@', $email)[0],
                'email' => $email,
                'google_id' => $googleId,
                'password' => Hash::make(\Illuminate\Support\Str::random(32)),
                'age' => 18,
                'sex' => 'Other',
                'course' => 'Not Specified',
                'year_level' => '1st Year',
                'is_verified' => true,
            ]);
        } else {
            if ($googleId && !$voter->google_id) {
                $voter->update(['google_id' => $googleId]);
            }
        }

        $token = $voter->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $voter->id,
                'name' => $voter->name,
                'email' => $voter->email,
                'role' => 'student',
                'hasVoted' => $voter->hasVotedIn(null),
                'is_new_user' => $isNewUser,
            ],
            'token' => $token,
        ]);
    }
}
