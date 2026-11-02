<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Announcement::with(['organization', 'course'])->orderBy('created_at', 'desc');

        if ($user instanceof \App\Models\Voter) {
            $orgId = $user->organization_id;
            $courseId = $user->course_id;
            $courseName = $user->course;

            $query->where(function ($q) use ($orgId, $courseId, $courseName) {
                // 1. Campus-wide announcements
                $q->where(function ($sub) {
                    $sub->where('target_type', 'all')
                        ->orWhere(function ($allSub) {
                            $allSub->whereNull('target_type')
                                   ->whereNull('organization_id')
                                   ->whereNull('course_id');
                        });
                });

                // 2. Organization-specific announcements
                if ($orgId) {
                    $q->orWhere(function ($sub) use ($orgId) {
                        $sub->where(function ($typeSub) {
                            $typeSub->where('target_type', 'organization')
                                    ->orWhereNull('target_type');
                        })
                        ->where('organization_id', $orgId)
                        ->whereNull('course_id');
                    });
                }

                // 3. Course-specific announcements — only voters registered in the same course
                if ($courseId || $courseName) {
                    $q->orWhere(function ($sub) use ($courseId, $courseName) {
                        // Must be a course-targeted (or legacy untagged) announcement...
                        $sub->where(function ($typeSub) {
                            $typeSub->where('target_type', 'course')
                                ->orWhereNull('target_type');
                        })
                        // ...whose course matches this voter's registered course
                        ->where(function ($matchSub) use ($courseId, $courseName) {
                            if ($courseId) {
                                $matchSub->where('course_id', $courseId);
                                if ($courseName) {
                                    $matchSub->orWhereHas('course', function ($rel) use ($courseName) {
                                        $rel->where('name', $courseName)
                                            ->orWhere('code', $courseName);
                                    });
                                }
                            } elseif ($courseName) {
                                $matchSub->whereHas('course', function ($rel) use ($courseName) {
                                    $rel->where('name', $courseName)
                                        ->orWhere('code', $courseName);
                                });
                            }
                        });
                    });
                }
            });
        } elseif ($request->filled('organization_id')) {
            if ($request->organization_id === 'global') {
                $query->whereNull('organization_id')->whereNull('course_id');
            } else {
                $query->where('organization_id', $request->organization_id);
            }
        } elseif ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $announcements = $query->get();

        return response()->json($announcements->map(function ($a) {
            $targetType = $a->target_type ?? ($a->course_id ? 'course' : ($a->organization_id ? 'organization' : 'all'));
            return [
                'id' => $a->id,
                'title' => $a->title ?? 'Announcement',
                'content' => $a->content,
                'type' => $a->type ?? 'info',
                'target_type' => $targetType,
                'organization_id' => $a->organization_id,
                'course_id' => $a->course_id,
                'organization' => $a->organization ? [
                    'id' => $a->organization->id,
                    'name' => $a->organization->name,
                    'code' => $a->organization->code,
                ] : null,
                'course' => $a->course ? [
                    'id' => $a->course->id,
                    'name' => $a->course->name,
                    'code' => $a->course->code,
                ] : null,
                'created_at' => $a->created_at,
            ];
        }));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'type' => 'in:info,warning,success',
            'target_type' => 'nullable|in:all,organization,course',
            'organization_id' => 'nullable|exists:organizations,id',
            'course_id' => 'nullable|exists:courses,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $data = $request->all();
        if ($request->input('target_type') === 'course' && $request->filled('course_id')) {
            $course = \App\Models\Course::find($request->course_id);
            if ($course && $course->organization_id && empty($data['organization_id'])) {
                $data['organization_id'] = $course->organization_id;
            }
        } elseif ($request->input('target_type') === 'all') {
            $data['organization_id'] = null;
            $data['course_id'] = null;
        }

        $announcement = Announcement::create($data);
        $announcement->load(['organization', 'course']);

        return response()->json([
            'id' => $announcement->id,
            'title' => $announcement->title,
            'content' => $announcement->content,
            'type' => $announcement->type,
            'target_type' => $announcement->target_type,
            'organization_id' => $announcement->organization_id,
            'course_id' => $announcement->course_id,
            'organization' => $announcement->organization ? [
                'id' => $announcement->organization->id,
                'name' => $announcement->organization->name,
                'code' => $announcement->organization->code,
            ] : null,
            'course' => $announcement->course ? [
                'id' => $announcement->course->id,
                'name' => $announcement->course->name,
                'code' => $announcement->course->code,
            ] : null,
            'created_at' => $announcement->created_at,
        ], 201);
    }

    public function destroy($id)
    {
        $announcement = Announcement::findOrFail($id);
        $announcement->delete();
        return response()->json(['message' => 'Announcement deleted successfully']);
    }
}
