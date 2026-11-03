<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Voter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ElectionController extends Controller
{
    private function mapStatusToApi($status)
    {
        return $status === 'ended' ? 'closed' : $status;
    }

    private function mapStatusFromApi($status)
    {
        return $status === 'closed' ? 'ended' : 'active';
    }

    private function transformElection($election)
    {
        $electionType = $election->election_type ?? ($election->course_id ? 'course' : ($election->organization_id ? 'organization' : 'all'));

        return [
            'id' => $election->id,
            'title' => $election->title,
            'description' => $election->description,
            'status' => $this->mapStatusToApi($election->status),
            'start_date' => $election->start_date,
            'end_date' => $election->end_date,
            'election_type' => $electionType,
            'organization_id' => $election->organization_id,
            'course_id' => $election->course_id,
            'organization' => $election->organization ? [
                'id' => $election->organization->id,
                'name' => $election->organization->name,
                'code' => $election->organization->code,
            ] : null,
            'course' => $election->course ? [
                'id' => $election->course->id,
                'name' => $election->course->name,
                'code' => $election->course->code,
            ] : null,
            'candidates' => $election->positions->flatMap(function ($position) use ($election) {
                return $position->candidates->map(function ($candidate) use ($election, $position) {
                    return [
                        'id' => $candidate->id,
                        'election_id' => $election->id,
                        'name' => $candidate->name,
                        'position' => $position->name,
                        'max_votes' => $position->max_votes ?? 1,
                        'description' => $candidate->description,
                        'photo' => $candidate->photo,
                    ];
                });
            })->values(),
        ];
    }

    public function index(Request $request)
    {
        $query = Election::with(['positions.candidates', 'organization', 'course']);

        if ($request->has('status')) {
            $dbStatus = $this->mapStatusFromApi($request->status);
            $query->where('status', $dbStatus);
        }

        $user = $request->user();
        if ($user instanceof Voter) {
            // Auto-resolve course_id on the voter if missing
            $vCourseId = $user->course_id;
            if (!$vCourseId && !empty($user->course) && $user->course !== 'Not Specified') {
                $resolved = \App\Models\Course::resolveForVoter($user->course, $user->organization_id);
                if ($resolved) {
                    $vCourseId = $resolved->id;
                    $user->course_id = $resolved->id;
                    if (!$user->organization_id && $resolved->organization_id) {
                        $user->organization_id = $resolved->organization_id;
                    }
                    $user->saveQuietly();
                }
            }

            $vOrgId = $user->organization_id;
            $vCourseText = trim($user->course ?? '');

            $query->where(function ($scope) use ($vOrgId, $vCourseId, $vCourseText) {
                // 1. Campus-wide elections (accessible to all voters)
                $scope->where(function ($allSub) {
                    $allSub->where('election_type', 'all')
                           ->orWhere(function ($fallbackAll) {
                               $fallbackAll->whereNull('election_type')
                                           ->whereNull('organization_id')
                                           ->whereNull('course_id');
                           });
                });

                // 2. Organization-scoped elections (accessible only to voters of that department/org)
                if ($vOrgId) {
                    $scope->orWhere(function ($orgSub) use ($vOrgId) {
                        $orgSub->where('organization_id', $vOrgId)
                               ->where(function ($typeSub) {
                                   $typeSub->where('election_type', 'organization')
                                           ->orWhere(function ($legacy) {
                                               $legacy->whereNull('election_type')
                                                      ->whereNull('course_id');
                                           });
                               })
                               ->whereNull('course_id');
                    });
                }

                // 3. Course-scoped elections (accessible ONLY to voters enrolled in this specific course)
                $scope->orWhere(function ($courseSub) use ($vCourseId, $vCourseText) {
                    $courseSub->where(function ($typeSub) {
                        $typeSub->where('election_type', 'course')
                                ->orWhereNotNull('course_id');
                    });

                    $courseSub->where(function ($matchSub) use ($vCourseId, $vCourseText) {
                        if ($vCourseId) {
                            $matchSub->where('course_id', $vCourseId);
                        } else {
                            $matchSub->whereRaw('0 = 1');
                        }

                        if ($vCourseText && $vCourseText !== 'Not Specified') {
                            $matchSub->orWhereHas('course', function ($cQ) use ($vCourseText) {
                                $cQ->whereRaw('LOWER(code) = ?', [strtolower($vCourseText)])
                                   ->orWhereRaw('LOWER(name) = ?', [strtolower($vCourseText)]);
                            });
                        }
                    });
                });
            });
        }

        $elections = $query->orderBy('created_at', 'desc')->get();

        return response()->json($elections->map(fn($e) => $this->transformElection($e)));
    }

    public function show(Request $request, $id)
    {
        $election = Election::with(['positions.candidates', 'organization', 'course'])->findOrFail($id);

        $user = $request->user();
        if ($user instanceof Voter && !$election->isEligibleVoter($user)) {
            $requiredScope = $election->isCourseScoped()
                ? ($election->course?->code ?: $election->course?->name ?: 'a specific course')
                : ($election->organization?->name ?: 'a specific department');

            return response()->json([
                'error' => "This election is restricted to {$requiredScope} enrolled voters.",
                'election_type' => $election->election_type,
            ], 403);
        }

        return response()->json($this->transformElection($election));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'in:draft,active,closed',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $data = $request->all();
        $data['status'] = $this->mapStatusFromApi($request->input('status', 'active'));

        $election = Election::create($data);
        return response()->json($this->transformElection($election->load('positions.candidates')), 201);
    }

    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:draft,active,closed',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $election = Election::findOrFail($id);
        $data = $request->all();

        if (isset($data['status'])) {
            $data['status'] = $this->mapStatusFromApi($data['status']);
        }

        $election->update($data);
        return response()->json($this->transformElection($election->load('positions.candidates')));
    }

    public function destroy($id)
    {
        $election = Election::findOrFail($id);
        $election->delete();
        return response()->json(['message' => 'Election deleted successfully']);
    }

    public function results($id)
    {
        $election = Election::with(['organization', 'course', 'positions.candidates.votes'])->findOrFail($id);

        $isClosed = in_array($election->status, ['ended', 'closed']);
        $user = request()->user();
        $isVoter = $user instanceof \App\Models\Voter;

        if ($isVoter && !$election->isEligibleVoter($user)) {
            $requiredScope = $election->isCourseScoped()
                ? ($election->course?->code ?: $election->course?->name ?: 'a specific course')
                : ($election->organization?->name ?: 'a specific department');

            return response()->json([
                'error' => "Results for this election are restricted to {$requiredScope} enrolled voters.",
            ], 403);
        }

        // Security / Integrity enforcement:
        // Candidate vote counts and standings are strictly sealed until the election has ended/closed.
        if (!$isClosed && $isVoter) {
            $positions = $election->positions->map(function ($position) {
                return [
                    'id' => $position->id,
                    'name' => $position->name,
                    'candidates' => $position->candidates->map(function ($candidate) {
                        return [
                            'id' => $candidate->id,
                            'name' => $candidate->name,
                            'photo' => $candidate->photo,
                            'vote_count' => null,
                            'percentage' => null,
                            'winner' => false,
                        ];
                    })->values(),
                ];
            })->values();

            return response()->json([
                'election' => [
                    'id' => $election->id,
                    'title' => $election->title,
                    'status' => $this->mapStatusToApi($election->status),
                    'organization' => $election->organization ? [
                        'id' => $election->organization->id,
                        'name' => $election->organization->name,
                    ] : null,
                ],
                'positions' => $positions,
                'total_votes' => $election->votes()->count(),
                'results_sealed' => true,
                'message' => 'Official vote tallies are sealed until voting has concluded to maintain election integrity.',
            ]);
        }

        // Concluded elections (or Admin view): Return full certified vote tallies
        $positions = $election->positions->map(function ($position) {
            $candidates = $position->candidates()->withCount('votes')->get();
            $totalVotes = $candidates->sum('votes_count');

            return [
                'id' => $position->id,
                'name' => $position->name,
                'candidates' => $candidates->map(function ($candidate) use ($totalVotes) {
                    return [
                        'id' => $candidate->id,
                        'name' => $candidate->name,
                        'photo' => $candidate->photo,
                        'vote_count' => $candidate->votes_count,
                        'percentage' => $totalVotes > 0 ? round(($candidate->votes_count / $totalVotes) * 100, 2) : 0,
                        'winner' => false,
                    ];
                })->sortByDesc('vote_count')->values()->map(function ($c, $idx) {
                    $c['winner'] = $idx === 0 && $c['vote_count'] > 0;
                    return $c;
                })->values(),
            ];
        })->values();

        return response()->json([
            'election' => [
                'id' => $election->id,
                'title' => $election->title,
                'status' => $this->mapStatusToApi($election->status),
                'organization' => $election->organization ? [
                    'id' => $election->organization->id,
                    'name' => $election->organization->name,
                ] : null,
            ],
            'positions' => $positions,
            'total_votes' => $election->votes()->count(),
            'results_sealed' => false,
        ]);
    }
}
