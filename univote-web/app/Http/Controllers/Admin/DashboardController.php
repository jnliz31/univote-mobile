<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Course;
use App\Models\Organization;
use App\Models\Vote;
use App\Models\Voter;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        if (! $request->expectsJson()) {
            return view('index');
        }

        $totalElections = Election::count();
        $activeElections = Election::where('status', 'active')->count();
        $completedElections = Election::whereIn('status', ['ended', 'closed'])->count();
        $totalVoters = Voter::count();
        $totalVotes = Vote::count();
        $completedProfiles = Voter::where('is_profile_completed', true)->count();

        $organizations = Organization::orderBy('name')->get();
        $voters = Voter::withCount('votes')->get();

        $organizationStats = $organizations->map(function ($org) use ($voters) {
            $orgVoters = $voters->where('organization_id', $org->id);
            $total = $orgVoters->count();
            $voted = $orgVoters->where('votes_count', '>', 0)->count();
            $notVoted = max(0, $total - $voted);
            $percentage = $total > 0 ? round(($voted / $total) * 100, 1) : 0.0;

            return [
                'id' => $org->id,
                'name' => $org->name,
                'code' => $org->code ?? $org->name,
                'total_voters' => $total,
                'voted' => $voted,
                'not_voted' => $notVoted,
                'participation_percentage' => $percentage,
            ];
        });

        // Check if there are any unassigned voters
        $unassignedVoters = $voters->whereNull('organization_id');
        if ($unassignedVoters->count() > 0) {
            $uTotal = $unassignedVoters->count();
            $uVoted = $unassignedVoters->where('votes_count', '>', 0)->count();
            $uNotVoted = max(0, $uTotal - $uVoted);
            $uPercentage = $uTotal > 0 ? round(($uVoted / $uTotal) * 100, 1) : 0.0;

            $organizationStats->push([
                'id' => null,
                'name' => 'Unassigned',
                'code' => 'N/A',
                'total_voters' => $uTotal,
                'voted' => $uVoted,
                'not_voted' => $uNotVoted,
                'participation_percentage' => $uPercentage,
            ]);
        }

        $courses = Course::orderBy('name')->get();
        $courseStats = $courses->map(function ($course) use ($voters) {
            $courseVoters = $voters->where('course_id', $course->id);
            $total = $courseVoters->count();
            $voted = $courseVoters->where('votes_count', '>', 0)->count();
            $notVoted = max(0, $total - $voted);
            $percentage = $total > 0 ? round(($voted / $total) * 100, 1) : 0.0;

            return [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->code,
                'organization_id' => $course->organization_id,
                'total_voters' => $total,
                'voted' => $voted,
                'not_voted' => $notVoted,
                'participation_percentage' => $percentage,
            ];
        });

        // --- Election Polls for active elections ---
        $activeElectionModels = Election::where('status', 'active')
            ->with([
                'organization',
                'course',
                'positions' => function ($q) {
                    $q->orderBy('order')->orderBy('id');
                },
                'positions.candidates' => function ($q) {
                    $q->withCount('votes');
                },
            ])
            ->withCount('votes')
            ->get();

        $electionPolls = $activeElectionModels->map(function ($election) {
            $positions = $election->positions->map(function ($position) {
                $candidates = $position->candidates->sortByDesc('votes_count');
                $totalPositionVotes = $candidates->sum('votes_count');
                $maxVotes = $candidates->max('votes_count') ?? 0;

                $rank = 0;
                $rankedCandidates = $candidates->map(function ($candidate) use ($totalPositionVotes, $maxVotes, &$rank) {
                    $rank++;
                    $voteCount = (int) $candidate->votes_count;
                    $percentage = $totalPositionVotes > 0 ? round(($voteCount / $totalPositionVotes) * 100, 1) : 0;

                    return [
                        'id'          => $candidate->id,
                        'name'        => $candidate->name,
                        'description' => $candidate->description ?? '',
                        'photo'       => $candidate->photo ? asset('storage/' . $candidate->photo) : null,
                        'vote_count'  => $voteCount,
                        'percentage'  => $percentage,
                        'rank'        => $rank,
                        'is_leading'  => $voteCount > 0 && $voteCount === $maxVotes,
                    ];
                })->values();

                return [
                    'id'           => $position->id,
                    'name'         => $position->name,
                    'total_votes'  => (int) $totalPositionVotes,
                    'candidates'   => $rankedCandidates,
                ];
            })->values();

            $org = $election->organization;

            return [
                'id'           => $election->id,
                'title'        => $election->title,
                'description'  => $election->description ?? '',
                'status'       => $election->status,
                'total_votes'  => (int) $election->votes_count,
                'start_date'   => $election->start_date,
                'end_date'     => $election->end_date,
                'organization' => $org ? [
                    'id'   => $org->id,
                    'name' => $org->name,
                    'code' => $org->code ?? $org->name,
                ] : null,
                'course'      => $election->course ? [
                    'id'              => $election->course->id,
                    'name'            => $election->course->name,
                    'code'            => $election->course->code,
                    'organization_id' => $election->course->organization_id,
                ] : null,
                'positions'    => $positions,
            ];
        });

        $recentElections = Election::with(['votes', 'organization'])
            ->latest('created_at')
            ->take(5)
            ->get()
            ->map(function ($election) {
                return [
                    'id' => $election->id,
                    'title' => $election->title,
                    'description' => $election->description,
                    'status' => $election->status,
                    'votes_count' => $election->votes->count(),
                    'created_at' => $election->created_at,
                    'organization' => $election->organization ? [
                        'id' => $election->organization->id,
                        'name' => $election->organization->name,
                        'code' => $election->organization->code,
                    ] : null,
                ];
            });

        return response()->json([
            'stats' => [
                'total_elections' => $totalElections,
                'active_elections' => $activeElections,
                'completed_elections' => $completedElections,
                'total_voters' => $totalVoters,
                'total_votes' => $totalVotes,
                'completed_profiles' => $completedProfiles,
            ],
            'organization_stats' => $organizationStats->values(),
            'course_stats'       => $courseStats->values(),
            'election_polls'     => $electionPolls->values(),
            'recent_elections'   => $recentElections->values(),
        ]);
    }
}
