<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vote;
use App\Models\Election;
use App\Models\Voter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class VoteController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user instanceof Voter) {
            return response()->json(['error' => 'Only voters can view votes'], 403);
        }

        $votes = Vote::where('voter_id', $user->id)
            ->with(['election.organization', 'candidate.position'])
            ->get();

        return response()->json($votes->map(function ($vote) {
            return [
                'id' => $vote->id,
                'user_id' => $vote->voter_id,
                'election_id' => $vote->election_id,
                'candidate_id' => $vote->candidate_id,
                'created_at' => $vote->created_at,
                'election' => [
                    'id' => $vote->election->id,
                    'title' => $vote->election->title,
                    'status' => $vote->election->status,
                    'organization' => $vote->election->organization?->name,
                ],
                'candidate' => [
                    'id' => $vote->candidate->id,
                    'name' => $vote->candidate->name,
                    'position' => $vote->candidate->position?->name ?? 'Candidate',
                    'photo' => $vote->candidate->photo,
                ],
            ];
        }));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user instanceof Voter) {
            return response()->json(['error' => 'Only voters can cast votes'], 403);
        }

        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,id',
            'candidate_id' => 'required_without:candidates|exists:candidates,id',
            'candidates' => 'required_without:candidate_id|array|min:1',
            'candidates.*' => 'distinct|exists:candidates,id',
            'facial_session_token' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        $election = Election::with(['positions.candidates', 'organization', 'course'])->findOrFail($request->election_id);

        if ($election->status !== 'active') {
            return response()->json(['error' => 'This election is not active'], 403);
        }

        if (!$election->isEligibleVoter($user)) {
            $requiredScope = $election->isCourseScoped()
                ? ($election->course?->code ?: $election->course?->name ?: 'this specific course')
                : ($election->organization?->name ?: 'this department');

            return response()->json([
                'error' => "You are not eligible to vote in this {$requiredScope} election.",
            ], 403);
        }

        $hasVoted = Vote::where('voter_id', $user->id)
            ->where('election_id', $request->election_id)
            ->exists();

        if ($hasVoted) {
            return response()->json(['error' => 'You have already voted in this election'], 403);
        }

        $user->load('facialProfile');

        // Security enforcement: Voting strictly requires an enrolled face profile
        if (!$user->facialProfile || !$user->facialProfile->is_enrolled) {
            return response()->json([
                'error' => 'You must enroll your face before you can cast a vote.',
                'error_code' => 'facial_enrollment_required',
                'facial_config' => $user->facial_config,
            ], 403);
        }

        // Security enforcement: Voting strictly requires a verified face session matching the registered face
        if (!$request->has('facial_session_token') || empty($request->facial_session_token)) {
            return response()->json([
                'error' => 'Facial verification is required before casting a vote. Please scan your face to verify your identity.',
                'error_code' => 'facial_verification_required',
                'facial_config' => $user->facial_config,
            ], 403);
        }

        if (!$this->validateFacialSession($user->id, $request->facial_session_token)) {
            return response()->json([
                'error' => 'Facial verification session is invalid or expired. Please verify your face again to vote.',
                'error_code' => 'facial_session_invalid',
                'facial_config' => $user->facial_config,
            ], 403);
        }

        $candidateIds = $request->has('candidates')
            ? $request->candidates
            : [$request->candidate_id];

        $candidatePositions = [];
        foreach ($election->positions as $position) {
            foreach ($position->candidates as $candidate) {
                $candidatePositions[$candidate->id] = $position;
            }
        }

        foreach ($candidateIds as $candidateId) {
            if (!isset($candidatePositions[(int) $candidateId])) {
                return response()->json(['error' => "Invalid candidate ID {$candidateId} for this election"], 422);
            }
        }

        $votesPerPosition = [];
        foreach ($candidateIds as $candidateId) {
            $position = $candidatePositions[(int) $candidateId];
            $votesPerPosition[$position->id] = ($votesPerPosition[$position->id] ?? 0) + 1;
            $maxVotes = max(1, (int) ($position->max_votes ?? 1));

            if ($votesPerPosition[$position->id] > $maxVotes) {
                return response()->json([
                    'error' => "You can select at most {$maxVotes} candidates for {$position->name}",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $createdVotes = [];
            foreach ($candidateIds as $candidateId) {
                $vote = Vote::create([
                    'voter_id' => $user->id,
                    'election_id' => $request->election_id,
                    'candidate_id' => $candidateId,
                ]);
                $createdVotes[] = $vote;
            }
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Votes submitted successfully',
                'votes' => count($createdVotes),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to submit votes: ' . $e->getMessage()], 500);
        }
    }

    private function validateFacialSession(int $voterId, string $token): bool
    {
        if (strpos($token, '.') === false) {
            return false;
        }

        [$payload, $signature] = explode('.', $token, 2);

        $expected = hash_hmac('sha256', $payload, config('app.key') . 'face-verification');
        if (!hash_equals($expected, $signature)) {
            return false;
        }

        $data = json_decode(base64_decode($payload), true);
        if (!$data) {
            return false;
        }

        if (($data['voter_id'] ?? 0) !== $voterId) {
            return false;
        }

        if (($data['exp'] ?? 0) < time()) {
            return false;
        }

        return true;
    }

    public function checkVote(Request $request, $electionId)
    {
        $user = $request->user();

        if (!$user instanceof Voter) {
            return response()->json(['has_voted' => false, 'eligible' => false]);
        }

        $election = Election::with(['organization', 'course'])->find($electionId);
        $isEligible = $election ? $election->isEligibleVoter($user) : false;

        $hasVoted = Vote::where('voter_id', $user->id)
            ->where('election_id', $electionId)
            ->exists();

        return response()->json([
            'has_voted' => $hasVoted,
            'eligible' => $isEligible,
        ]);
    }
}
