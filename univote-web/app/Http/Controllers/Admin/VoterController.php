<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Organization;
use App\Models\Voter;
use Illuminate\Http\Request;

class VoterController extends Controller
{
    public function index(Request $request)
    {
        if (! $request->expectsJson()) {
            return view('index');
        }

        $query = Voter::with(['organization', 'courseRelation'])->withCount('votes')->orderBy('name');

        if ($request->filled('organization_id')) {
            $orgId = $request->query('organization_id');
            if ($orgId === 'unassigned') {
                $query->whereNull('organization_id');
            } else {
                $query->where('organization_id', $orgId);
            }
        }

        if ($request->filled('course_id')) {
            $cId = $request->query('course_id');
            if ($cId === 'unassigned') {
                $query->whereNull('course_id')->where(function ($q) {
                    $q->whereNull('course')->orWhere('course', '');
                });
            } else {
                $query->where('course_id', $cId);
            }
        } elseif ($request->filled('course') && $request->query('course') !== 'all') {
            $courseVal = $request->query('course');
            $query->where(function ($q) use ($courseVal) {
                $q->where('course', $courseVal)
                  ->orWhereHas('courseRelation', function ($rel) use ($courseVal) {
                      $rel->where('code', $courseVal)->orWhere('name', $courseVal);
                  });
            });
        }

        $voters = $query->get()->map(function ($voter) {
            $voter->has_voted = $voter->votes_count > 0;

            return $voter;
        });

        $organizations = Organization::orderBy('name')->get(['id', 'name', 'code']);
        $allCourses = Course::getAllCourses();

        return response()->json([
            'voters' => $voters,
            'organizations' => $organizations,
            'courses' => $allCourses,
            'enrolled_courses' => $allCourses,
        ]);
    }

    public function update(Request $request, Voter $voter)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'age' => 'nullable|integer|min:15|max:120',
            'sex' => 'nullable|string|in:Male,Female,Other,male,female,other',
            'course' => 'nullable|string|max:255',
            'course_id' => 'nullable|exists:courses,id',
            'organization_id' => 'nullable|exists:organizations,id',
        ]);

        $courseName = $validated['course'] ?? null;
        $courseId = $validated['course_id'] ?? null;
        $orgId = $validated['organization_id'] ?? null;

        if ($courseId) {
            $courseObj = Course::find($courseId);
            if ($courseObj) {
                $courseName = $courseObj->code ?: $courseObj->name;
                if ($courseObj->organization_id && empty($orgId)) {
                    $orgId = $courseObj->organization_id;
                }
            }
        } elseif (!empty($courseName)) {
            $courseObj = Course::resolveForVoter($courseName, $orgId);
            if ($courseObj) {
                $courseId = $courseObj->id;
                if ($courseObj->organization_id && empty($orgId)) {
                    $orgId = $courseObj->organization_id;
                }
            }
        }

        $updateData = [
            'name' => $validated['name'],
            'course' => $courseName,
            'course_id' => $courseId,
            'organization_id' => $orgId,
        ];

        if (array_key_exists('age', $validated)) {
            $updateData['age'] = $validated['age'];
        }

        if (array_key_exists('sex', $validated)) {
            $sex = null;
            if (! empty($validated['sex'])) {
                $normalizedSex = strtolower(trim($validated['sex']));
                if (in_array($normalizedSex, ['male', 'female', 'other'])) {
                    $sex = ucfirst($normalizedSex);
                }
            }
            $updateData['sex'] = $sex;
        }

        // Strictly update only safe profile attributes without touching auth/login data or voting history
        $voter->update($updateData);

        $updatedVoter = $voter->fresh(['organization', 'courseRelation']);
        $updatedVoter->loadCount('votes');
        $updatedVoter->has_voted = $updatedVoter->votes_count > 0;

        return response()->json([
            'success' => true,
            'message' => 'Voter updated successfully!',
            'voter' => $updatedVoter,
        ]);
    }

    public function destroy(Voter $voter)
    {
        try {
            $voter->delete();

            return response()->json([
                'success' => true,
                'message' => 'Voter deleted successfully!',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete voter: '.$e->getMessage(),
            ], 500);
        }
    }
}
