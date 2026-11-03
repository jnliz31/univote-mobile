<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Organization;

class OrganizationController extends Controller
{
    public function index()
    {
        return response()->json(Organization::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']));
    }

    public function courses(Organization $organization)
    {
        if (!$organization->is_active) {
            return response()->json(['error' => 'Organization is not available.'], 404);
        }

        $courses = Course::where('organization_id', $organization->id)
            ->where('status', 'assigned')
            ->orderBy('name')
            ->get(['id', 'organization_id', 'name', 'code']);

        return response()->json(['courses' => $courses]);
    }
}