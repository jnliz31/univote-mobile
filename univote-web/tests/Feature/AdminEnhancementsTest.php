<?php

use App\Models\Admin;
use App\Models\Course;
use App\Models\Election;
use App\Models\Organization;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminEnhancementsTest extends TestCase
{
    use RefreshDatabase;

    protected Admin $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = Admin::firstOrCreate(
            ['email' => 'testadmin@univote.edu'],
            ['name' => 'Test Admin', 'password' => bcrypt('password123')]
        );
    }

    public function test_admin_dashboard_returns_organization_voter_statistics_with_participation_and_demographics(): void
    {
        // Arrange test organization and voters
        $org = Organization::firstOrCreate(
            ['code' => 'TEST_ORG'],
            ['name' => 'Test Organization', 'is_active' => true]
        );

        $voterMale = Voter::firstOrCreate(
            ['email' => 'male_voter@test.edu'],
            [
                'name' => 'Male Voter',
                'password' => bcrypt('secret'),
                'age' => 20,
                'sex' => 'Male',
                'course' => 'BSCS',
                'organization_id' => $org->id,
            ]
        );

        $voterFemale = Voter::firstOrCreate(
            ['email' => 'female_voter@test.edu'],
            [
                'name' => 'Female Voter',
                'password' => bcrypt('secret'),
                'age' => 21,
                'sex' => 'Female',
                'course' => 'BSIT',
                'organization_id' => $org->id,
            ]
        );

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/dashboard');

        $response->assertOk();
        $response->assertJsonStructure([
            'stats' => ['total_elections', 'active_elections', 'total_voters', 'total_votes'],
            'organization_stats' => [
                '*' => [
                    'id',
                    'name',
                    'code',
                    'total_voters',
                    'voted',
                    'not_voted',
                    'participation_percentage',
                ],
            ],
        ]);

        $orgStats = collect($response->json('organization_stats'))->firstWhere('code', 'TEST_ORG');
        expect($orgStats)->not->toBeNull();
        expect($orgStats['total_voters'])->toBeGreaterThanOrEqual(2);
    }

    public function test_dashboard_includes_course_details_for_course_scoped_active_elections(): void
    {
        $organization = Organization::create([
            'name' => 'Course Election Organization',
            'code' => 'COURSE_ELECTION_ORG',
        ]);
        $course = Course::create([
            'name' => 'Bachelor of Science in Computer Science',
            'code' => 'BSCS',
            'organization_id' => $organization->id,
            'status' => 'assigned',
        ]);
        $election = Election::create([
            'title' => 'Course Election',
            'status' => 'active',
            'election_type' => 'course',
            'organization_id' => $organization->id,
            'course_id' => $course->id,
        ]);

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/dashboard');

        $response->assertOk();
        $response->assertJsonPath('election_polls.0.id', $election->id);
        $response->assertJsonPath('election_polls.0.course.id', $course->id);
        $response->assertJsonPath('election_polls.0.course.code', 'BSCS');
        $response->assertJsonPath('election_polls.0.course.name', 'Bachelor of Science in Computer Science');
    }

    public function test_admin_voters_index_returns_voting_status_and_supports_organization_filtering(): void
    {
        $org = Organization::firstOrCreate(
            ['code' => 'VOTE_ORG'],
            ['name' => 'Voters Test Organization', 'is_active' => true]
        );

        $voter = Voter::firstOrCreate(
            ['email' => 'status_voter@test.edu'],
            [
                'name' => 'Status Voter',
                'password' => bcrypt('secret'),
                'age' => 22,
                'sex' => 'Other',
                'course' => 'BSCE',
                'organization_id' => $org->id,
            ]
        );

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/voters');

        $response->assertOk();
        $response->assertJsonStructure([
            'voters' => [
                '*' => ['id', 'name', 'email', 'age', 'sex', 'course', 'course_relation', 'organization_id', 'has_voted'],
            ],
        ]);

        // Test filtering by organization
        $filteredResponse = $this->actingAs($this->admin, 'admin')->getJson('/admin/voters?organization_id='.$org->id);
        $filteredResponse->assertOk();
        $votersInOrg = $filteredResponse->json('voters');
        foreach ($votersInOrg as $item) {
            expect($item['organization_id'])->toBe($org->id);
        }
    }

    public function test_admin_can_update_voter_demographic_and_organization_details_safely_without_overwriting_auth_or_vote_history(): void
    {
        $org1 = Organization::firstOrCreate(
            ['code' => 'ORG_A'],
            ['name' => 'Org A', 'is_active' => true]
        );
        $org2 = Organization::firstOrCreate(
            ['code' => 'ORG_B'],
            ['name' => 'Org B', 'is_active' => true]
        );

        $originalPassword = bcrypt('supersecret');
        $voter = Voter::create([
            'name' => 'Original Name',
            'email' => 'edit_test_'.uniqid().'@test.edu',
            'password' => $originalPassword,
            'age' => 19,
            'sex' => 'Male',
            'course' => 'BS Biology',
            'organization_id' => $org1->id,
        ]);

        // Test form validation: Name is required
        $invalidResponse = $this->actingAs($this->admin, 'admin')->putJson("/admin/voters/{$voter->id}", [
            'name' => '',
        ]);
        $invalidResponse->assertUnprocessable();

        // Test form validation: Invalid age (< 15)
        $invalidAgeResponse = $this->actingAs($this->admin, 'admin')->putJson("/admin/voters/{$voter->id}", [
            'name' => 'Valid Name',
            'age' => 10,
        ]);
        $invalidAgeResponse->assertUnprocessable();

        // Test form validation: Invalid sex
        $invalidSexResponse = $this->actingAs($this->admin, 'admin')->putJson("/admin/voters/{$voter->id}", [
            'name' => 'Valid Name',
            'sex' => 'InvalidGenderChoice',
        ]);
        $invalidSexResponse->assertUnprocessable();

        // Valid update
        $validResponse = $this->actingAs($this->admin, 'admin')->putJson("/admin/voters/{$voter->id}", [
            'name' => 'Updated Jane Doe',
            'age' => 23,
            'sex' => 'Female',
            'course' => 'BS Information Systems',
            'organization_id' => $org2->id,
        ]);

        $validResponse->assertOk();
        $validResponse->assertJsonPath('voter.name', 'Updated Jane Doe');
        $validResponse->assertJsonPath('voter.age', 23);
        $validResponse->assertJsonPath('voter.sex', 'Female');
        $validResponse->assertJsonPath('voter.course', 'BS Information Systems');
        $validResponse->assertJsonPath('voter.organization_id', $org2->id);

        // Verify database record & ensure password/email were preserved
        $freshVoter = $voter->fresh();
        expect($freshVoter->name)->toBe('Updated Jane Doe');
        expect($freshVoter->password)->toBe($originalPassword);
        expect($freshVoter->email)->toBe($voter->email);
    }

    public function test_admin_results_endpoint_only_returns_finished_elections_and_includes_formatted_dates_and_organization_info(): void
    {
        $org = Organization::firstOrCreate(
            ['code' => 'RESULTS_ORG'],
            ['name' => 'Results Org', 'is_active' => true]
        );

        // Create an active election (must NOT appear in results)
        $activeElection = Election::create([
            'title' => 'Active Election '.uniqid(),
            'status' => 'active',
            'organization_id' => $org->id,
        ]);

        // Create a finished election (must appear in results)
        $finishedElection = Election::create([
            'title' => 'Concluded Election '.uniqid(),
            'status' => 'ended',
            'organization_id' => $org->id,
            'start_date' => now()->subDays(2),
            'end_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/results');

        $response->assertOk();
        $results = collect($response->json('results'));

        // Verify only finished election appears, active election does not
        expect($results->pluck('id')->contains($activeElection->id))->toBeFalse();
        expect($results->pluck('id')->contains($finishedElection->id))->toBeTrue();

        // Verify election data includes organization and formatted timestamps
        $found = $results->firstWhere('id', $finishedElection->id);
        expect($found)->not->toBeNull();
        expect($found['status'])->toBe('ended');
        expect($found['organization'])->not->toBeNull();
        expect($found['organization']['code'])->toBe('RESULTS_ORG');
        expect($found['created_at_formatted'])->not->toBeNull();
        expect($found['end_date_formatted'])->not->toBeNull();
    }

    public function test_manage_elections_endpoint_only_returns_active_elections_and_excludes_ended_elections(): void
    {
        $active = Election::create([
            'title' => 'Ongoing Election '.uniqid(),
            'status' => 'active',
        ]);

        $ended = Election::create([
            'title' => 'Finished Election '.uniqid(),
            'status' => 'ended',
            'end_date' => now()->subDay(),
        ]);

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/elections');
        $response->assertOk();

        $ids = collect($response->json('elections'))->pluck('id');
        expect($ids->contains($active->id))->toBeTrue();
        expect($ids->contains($ended->id))->toBeFalse();
    }

    public function test_ended_election_cannot_be_edited_but_can_be_deleted_by_admin(): void
    {
        $ended = Election::create([
            'title' => 'Concluded Election To Edit '.uniqid(),
            'status' => 'ended',
            'end_date' => now()->subDay(),
        ]);

        // Attempting to edit an ended election must be rejected with 422
        $editResponse = $this->actingAs($this->admin, 'admin')->putJson("/admin/elections/{$ended->id}", [
            'title' => 'Modified Title',
            'positions' => [
                [
                    'name' => 'President',
                    'max_votes' => 1,
                    'candidates' => ['Candidate 1'],
                ],
            ],
        ]);
        $editResponse->assertStatus(422);
        $editResponse->assertJsonFragment(['success' => false]);

        // Deleting an ended election is permitted for the admin
        $deleteResponse = $this->actingAs($this->admin, 'admin')->deleteJson("/admin/elections/{$ended->id}");
        $deleteResponse->assertOk();
        $deleteResponse->assertJsonFragment(['success' => true]);
        expect(Election::find($ended->id))->toBeNull();
    }

    public function test_results_endpoint_calculates_total_voters_who_voted_and_declares_winners(): void
    {
        $election = Election::create([
            'title' => 'Finished Election With Winners '.uniqid(),
            'status' => 'ended',
            'end_date' => now()->subDay(),
        ]);

        $pos = \App\Models\Position::create([
            'election_id' => $election->id,
            'name' => 'Governor',
            'max_votes' => 1,
            'order' => 1,
        ]);

        $cand1 = \App\Models\Candidate::create([
            'position_id' => $pos->id,
            'name' => 'Leading Candidate',
        ]);

        $cand2 = \App\Models\Candidate::create([
            'position_id' => $pos->id,
            'name' => 'Runner Up Candidate',
        ]);

        $voter1 = Voter::create([
            'name' => 'Voter 1',
            'email' => 'v1_'.uniqid().'@test.edu',
            'password' => bcrypt('password'),
            'age' => 20,
            'sex' => 'Female',
            'course' => 'BSCS',
        ]);

        $voter2 = Voter::create([
            'name' => 'Voter 2',
            'email' => 'v2_'.uniqid().'@test.edu',
            'password' => bcrypt('password'),
            'age' => 21,
            'sex' => 'Male',
            'course' => 'BSCS',
        ]);

        // Cast votes: voter1 votes for cand1, voter2 votes for cand1
        \App\Models\Vote::create([
            'voter_id' => $voter1->id,
            'candidate_id' => $cand1->id,
            'election_id' => $election->id,
        ]);
        \App\Models\Vote::create([
            'voter_id' => $voter2->id,
            'candidate_id' => $cand1->id,
            'election_id' => $election->id,
        ]);

        $response = $this->actingAs($this->admin, 'admin')->getJson('/admin/results');
        $response->assertOk();

        $found = collect($response->json('results'))->firstWhere('id', $election->id);
        expect($found)->not->toBeNull();
        expect($found['total_voters_who_voted'])->toBe(2);
        expect($found['total_votes_cast'])->toBe(2);
        expect($found['winners'])->toHaveCount(1);
        expect($found['winners'][0]['candidate_name'])->toBe('Leading Candidate');
        expect($found['winners'][0]['vote_count'])->toBe(2);
    }

    public function test_admin_audit_logs_can_be_sorted_and_filtered_by_organization(): void
    {
        $orgA = \App\Models\Organization::create(['name' => 'Alpha Department', 'code' => 'ALPHA']);
        $orgB = \App\Models\Organization::create(['name' => 'Beta Department', 'code' => 'BETA']);

        $logA = \App\Models\AuditLog::create([
            'actor_name' => 'Alpha User',
            'action' => 'VOTE_CAST',
            'organization_id' => $orgA->id,
            'platform' => 'Mobile App',
        ]);

        $logB = \App\Models\AuditLog::create([
            'actor_name' => 'Beta User',
            'action' => 'CREATE_ELECTION',
            'organization_id' => $orgB->id,
            'platform' => 'Web Browser',
        ]);

        // Test filter by organization_id
        $respA = $this->actingAs($this->admin, 'admin')->getJson("/admin/audit-logs?organization_id={$orgA->id}");
        $respA->assertOk();
        $dataA = collect($respA->json('logs.data'));
        expect($dataA->pluck('id')->contains($logA->id))->toBeTrue();
        expect($dataA->pluck('id')->contains($logB->id))->toBeFalse();

        // Test sort by organization name
        $respSort = $this->actingAs($this->admin, 'admin')->getJson('/admin/audit-logs?sort_by=organization&sort_order=asc');
        $respSort->assertOk();
        expect($respSort->json('organizations'))->not->toBeEmpty();
    }

    public function test_admin_can_delete_individual_audit_log_group_of_audit_logs_or_all_audit_logs(): void
    {
        $org = \App\Models\Organization::create(['name' => 'Audit Org '.uniqid(), 'code' => 'AORG']);

        $log1 = \App\Models\AuditLog::create([
            'actor_name' => 'Actor 1',
            'action' => 'TEST_ACTION_1',
            'organization_id' => $org->id,
            'platform' => 'Mobile App',
        ]);

        $log2 = \App\Models\AuditLog::create([
            'actor_name' => 'Actor 2',
            'action' => 'TEST_ACTION_2',
            'organization_id' => $org->id,
            'platform' => 'Mobile App',
        ]);

        $log3 = \App\Models\AuditLog::create([
            'actor_name' => 'Actor 3',
            'action' => 'TEST_ACTION_3',
            'platform' => 'Web Browser',
        ]);

        // 1. Delete individual audit log
        $delSingle = $this->actingAs($this->admin, 'admin')->deleteJson("/admin/audit-logs/{$log1->id}");
        $delSingle->assertOk();
        expect(\App\Models\AuditLog::find($log1->id))->toBeNull();

        // 2. Delete by group (array of IDs)
        $delGroup = $this->actingAs($this->admin, 'admin')->postJson('/admin/audit-logs/delete-group', [
            'ids' => [$log2->id],
        ]);
        $delGroup->assertOk();
        expect(\App\Models\AuditLog::find($log2->id))->toBeNull();

        // 3. Delete by group criteria (platform)
        $log4 = \App\Models\AuditLog::create([
            'actor_name' => 'Actor 4',
            'action' => 'GROUP_DELETE_ME',
            'platform' => 'Mobile App',
        ]);
        $delCriteria = $this->actingAs($this->admin, 'admin')->postJson('/admin/audit-logs/delete-group', [
            'platform' => 'Mobile App',
        ]);
        $delCriteria->assertOk();
        expect(\App\Models\AuditLog::find($log4->id))->toBeNull();

        // 4. Delete all audit logs
        $delAll = $this->actingAs($this->admin, 'admin')->deleteJson('/admin/audit-logs/delete-all');
        $delAll->assertOk();
        expect(\App\Models\AuditLog::count())->toBe(0);
    }

    public function test_admin_can_create_election_with_organization_and_triggers_audit_log_correctly(): void
    {
        $org = Organization::firstOrCreate(
            ['code' => 'AUDIT_ELECTION_ORG'],
            ['name' => 'Audit Election Organization', 'is_active' => true]
        );

        $response = $this->actingAs($this->admin, 'admin')->postJson('/admin/elections', [
            'title' => 'Test Audit Election',
            'description' => 'Test description',
            'election_type' => 'organization',
            'organization_id' => $org->id,
            'positions' => [
                [
                    'name' => 'President',
                    'max_votes' => 1,
                    'candidates' => ['Candidate A', 'Candidate B'],
                ],
            ],
        ]);

        $response->assertStatus(201);
        $response->assertJsonFragment(['success' => true]);

        $electionId = $response->json('election.id');
        expect($electionId)->not->toBeNull();

        $log = \App\Models\AuditLog::where('action', 'CREATE_ELECTION')
            ->where('model_id', $electionId)
            ->first();

        expect($log)->not->toBeNull();
        expect($log->organization_id)->toBe($org->id);
    }
}
