<?php

namespace App\Http\Controllers\Admin;

use App\Events\ElectionEnded;
use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Course;
use App\Models\Election;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ElectionController extends Controller
{
    public function index()
    {
        if (! request()->expectsJson()) {
            return view('index');
        }

        $query = Election::with(['positions.candidates', 'votes', 'organization', 'course']);

        if (! request()->boolean('include_ended')) {
            $query->whereNotIn('status', ['ended', 'closed']);
        }

        if (request()->filled('election_type') && request('election_type') !== 'all_scopes') {
            $query->where('election_type', request('election_type'));
        }
        if (request()->filled('course_id')) {
            $query->where('course_id', request('course_id'));
        }

        $elections = $query->latest('created_at')->get();

        $electionsData = $elections->map(function ($election) {
            return [
                'id'              => $election->id,
                'title'           => $election->title,
                'description'     => $election->description,
                'status'          => $election->status,
                'election_type'   => $election->election_type ?? 'all',
                'positions_count' => $election->positions->count(),
                'votes_count'     => $election->votes->count(),
                'created_at'      => $election->created_at,
                'start_date'      => $election->start_date,
                'end_date'        => $election->end_date,
                'organization_id' => $election->organization_id,
                'course_id'       => $election->course_id,
                'organization'    => $election->organization ? [
                    'id'   => $election->organization->id,
                    'name' => $election->organization->name,
                    'code' => $election->organization->code,
                ] : null,
                'course' => $election->course ? [
                    'id'   => $election->course->id,
                    'name' => $election->course->name,
                    'code' => $election->course->code,
                ] : null,
            ];
        });

        // Also return organizations and all courses for selectors
        $organizations = \App\Models\Organization::orderBy('name')->get(['id', 'name', 'code']);
        $allCourses    = Course::getAllCourses();

        return response()->json([
            'elections'        => $electionsData,
            'organizations'    => $organizations,
            'courses'          => $allCourses,
            'enrolled_courses' => $allCourses,
        ]);
    }

    public function create(Request $request)
    {
        if (! $request->expectsJson()) {
            return view('index');
        }

        $allCourses    = Course::getAllCourses();
        $organizations = \App\Models\Organization::with(['courses' => function ($q) {
            $q->withCount('voters')->orderBy('name');
        }])->orderBy('name')->get(['id', 'name', 'code']);

        return response()->json([
            'organizations'    => $organizations,
            'courses'          => $allCourses,
            'enrolled_courses' => $allCourses,
        ]);
    }

    public function store(Request $request)
    {
        $electionType = $request->input('election_type', 'all');

        $request->validate([
            'title'         => 'required|string|max:255',
            'election_type' => 'required|in:all,organization,course',
            'organization_id' => $electionType === 'organization'
                ? 'required|exists:organizations,id'
                : 'nullable|exists:organizations,id',
            'course_id' => $electionType === 'course'
                ? 'required|exists:courses,id'
                : 'nullable|exists:courses,id',
            'positions'                        => 'required|array|min:1',
            'positions.*.name'                 => 'required|string|max:255',
            'positions.*.max_votes'            => 'required|integer|min:1',
            'positions.*.candidates'           => 'required|array|min:1',
            'positions.*.candidates.*'         => 'required',
        ]);

        // When course election, derive organization from course or enrolled voters
        $organizationId = $request->organization_id;
        $courseId       = null;

        if ($electionType === 'course') {
            $course         = Course::findOrFail($request->course_id);
            $courseId       = $course->id;
            $organizationId = $course->organization_id ?: ($request->organization_id ?: $course->voters()->whereNotNull('organization_id')->value('organization_id'));
        }

        if ($electionType === 'all') {
            $organizationId = null;
            $courseId       = null;
        }

        $election = Election::create([
            'title'           => $request->title,
            'description'     => $request->description ?? '',
            'status'          => 'active',
            'election_type'   => $electionType,
            'organization_id' => $organizationId,
            'course_id'       => $courseId,
        ]);

        foreach ($request->positions as $index => $positionData) {
            $position = Position::create([
                'election_id' => $election->id,
                'name'        => $positionData['name'],
                'max_votes'   => $positionData['max_votes'],
                'order'       => $index,
            ]);

            foreach ($positionData['candidates'] as $candidate) {
                $normalized = $this->normalizeCandidate($candidate);

                if ($normalized === null) {
                    continue;
                }

                Candidate::create([
                    'position_id' => $position->id,
                    'name'        => $normalized['name'],
                    'description' => $normalized['description'],
                    'photo'       => $normalized['photo'],
                ]);
            }
        }

        return response()->json([
            'success'  => true,
            'message'  => 'Election created successfully!',
            'election' => $election->load(['positions.candidates', 'organization', 'course']),
        ], 201);
    }

    public function edit(Election $election)
    {
        if (! request()->expectsJson()) {
            return view('index');
        }

        $election->load(['positions.candidates', 'organization', 'course']);

        $organizations = \App\Models\Organization::orderBy('name')->get(['id', 'name', 'code']);
        $allCourses    = Course::getAllCourses();

        return response()->json([
            'election'         => $election,
            'organizations'    => $organizations,
            'courses'          => $allCourses,
            'enrolled_courses' => $allCourses,
        ]);
    }

    public function update(Request $request, Election $election)
    {
        if ($election->status === 'ended' || $election->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Archived/ended elections are permanently sealed and cannot be edited.',
            ], 422);
        }

        $electionType = $request->input('election_type', $election->election_type ?? 'all');

        $request->validate([
            'title'         => 'required|string|max:255',
            'election_type' => 'required|in:all,organization,course',
            'organization_id' => $electionType === 'organization'
                ? 'required|exists:organizations,id'
                : 'nullable|exists:organizations,id',
            'course_id' => $electionType === 'course'
                ? 'required|exists:courses,id'
                : 'nullable|exists:courses,id',
            'positions'                => 'required|array|min:1',
            'positions.*.name'         => 'required|string|max:255',
            'positions.*.max_votes'    => 'required|integer|min:1',
            'positions.*.candidates'   => 'required|array|min:1',
            'positions.*.candidates.*' => 'required',
        ]);

        $organizationId = $request->organization_id;
        $courseId       = null;

        if ($electionType === 'course') {
            $course         = Course::findOrFail($request->course_id);
            $courseId       = $course->id;
            $organizationId = $course->organization_id ?: ($request->organization_id ?: $course->voters()->whereNotNull('organization_id')->value('organization_id'));
        }

        if ($electionType === 'all') {
            $organizationId = null;
            $courseId       = null;
        }

        $election->update([
            'title'           => $request->title,
            'description'     => $request->description ?? $election->description,
            'election_type'   => $electionType,
            'organization_id' => $organizationId,
            'course_id'       => $courseId,
        ]);

        $election->positions()->delete();

        foreach ($request->positions as $index => $positionData) {
            $position = Position::create([
                'election_id' => $election->id,
                'name'        => $positionData['name'],
                'max_votes'   => $positionData['max_votes'],
                'order'       => $index,
            ]);

            foreach ($positionData['candidates'] as $candidate) {
                $normalized = $this->normalizeCandidate($candidate);

                if ($normalized === null) {
                    continue;
                }

                Candidate::create([
                    'position_id' => $position->id,
                    'name'        => $normalized['name'],
                    'description' => $normalized['description'],
                    'photo'       => $normalized['photo'],
                ]);
            }
        }

        return response()->json([
            'success'  => true,
            'message'  => 'Election updated successfully!',
            'election' => $election->fresh()->load(['positions.candidates', 'organization', 'course']),
        ]);
    }

    public function endElection(Election $election)
    {
        $election->update([
            'status'   => 'ended',
            'end_date' => $election->end_date ?? now(),
        ]);

        ElectionEnded::dispatch($election);

        return response()->json([
            'success' => true,
            'message' => 'Election ended successfully!',
        ]);
    }

    public function destroy(Election $election)
    {
        if ($election->status === 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete an active election. Please end the election first before deleting.',
            ], 422);
        }

        try {
            $election->delete();

            return response()->json([
                'success' => true,
                'message' => 'Election deleted successfully! All associated data (positions, candidates, and votes) have been removed.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete election: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Normalize a candidate input, which may be a plain name string (legacy)
     * or an object with name/description/photo (base64 data URI).
     */
    private function normalizeCandidate($candidate): ?array
    {
        if (is_string($candidate)) {
            $candidate = ['name' => $candidate];
        }

        if (! is_array($candidate)) {
            return null;
        }

        $name = trim((string) ($candidate['name'] ?? ''));
        if ($name === '') {
            return null;
        }

        $description = $candidate['description'] ?? null;
        $description = is_string($description) ? trim($description) : null;

        return [
            'name'        => $name,
            'description' => ($description !== null && $description !== '') ? $description : null,
            'photo'       => $this->storeCandidatePhoto($candidate['photo'] ?? null),
        ];
    }

    /**
     * Persist a candidate photo. Accepts either an already-stored relative
     * path (returned unchanged) or a base64 data URI which is decoded and
     * written to the public disk.
     */
    private function storeCandidatePhoto($photo): ?string
    {
        if (! is_string($photo) || trim($photo) === '') {
            return null;
        }

        // Already a stored path (e.g. editing without changing the photo).
        if (! str_starts_with($photo, 'data:')) {
            return $photo;
        }

        if (! preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $photo, $matches)) {
            return null;
        }

        $binary = base64_decode(substr($photo, strpos($photo, ',') + 1), true);
        if ($binary === false) {
            return null;
        }

        $extension = strtolower($matches[1]);
        if ($extension === 'jpeg') {
            $extension = 'jpg';
        }
        if (! in_array($extension, ['jpg', 'png', 'webp', 'gif'], true)) {
            $extension = 'jpg';
        }

        $path = 'candidates/' . Str::uuid() . '.' . $extension;
        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}
