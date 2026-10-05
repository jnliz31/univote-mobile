<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminAuthController extends Controller
{
    public function check(Request $request)
    {
        $isAuthenticated = Auth::guard('admin')->check();

        return response()->json([
            'authenticated' => $isAuthenticated,
            'auth_token' => $isAuthenticated ? 'authenticated' : null,
            'user_role' => $isAuthenticated ? 'admin' : null,
            'admin' => $isAuthenticated ? Auth::guard('admin')->user() : null,
        ]);
    }

    public function showLogin()
    {
        return view('index');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (Auth::guard('admin')->attempt($credentials)) {
            $request->session()->regenerate();
            $admin = Auth::guard('admin')->user();
            
            \App\Models\AuditLog::record([
                'user_id'    => $admin->id,
                'user_type'  => get_class($admin),
                'actor_name' => $admin->name ?? $admin->email,
                'action'     => 'LOGIN_SUCCESS',
                'description'=> 'Admin logged in via Web Admin panel',
            ]);

            // Return JSON for API
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Login successful',
                    'admin'   => $admin
                ]);
            }
            
            return redirect()->intended('/admin/dashboard');
        }

        \App\Models\AuditLog::record([
            'user_id'    => null,
            'actor_name' => $request->input('email'),
            'action'     => 'LOGIN_FAILED',
            'description'=> 'Failed login attempt on Web Admin panel',
            'severity'   => 'warning',
        ]);

        // Return JSON error for API
        if ($request->expectsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        return back()->withErrors([
            'email' => 'The provided credentials do not match our records.',
        ])->onlyInput('email');
    }

    public function logout(Request $request)
    {
        $admin = Auth::guard('admin')->user();
        if ($admin) {
            \App\Models\AuditLog::record([
                'user_id'    => $admin->id,
                'user_type'  => get_class($admin),
                'actor_name' => $admin->name ?? $admin->email,
                'action'     => 'LOGOUT',
                'description'=> 'Admin logged out from Web Admin panel',
            ]);
        }

        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        
        if ($request->expectsJson()) {
            return response()->json(['success' => true]);
        }
        
        return redirect('/admin/login');
    }
}