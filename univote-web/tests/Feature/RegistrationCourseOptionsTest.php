<?php

use App\Models\Course;
use App\Models\Organization;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrationCourseOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_course_options_only_include_assigned_courses_for_the_selected_active_organization(): void
    {
        $organization = Organization::create([
            'name' => 'Arts and Sciences',
            'code' => 'CAS',
            'is_active' => true,
        ]);
        $otherOrganization = Organization::create([
            'name' => 'Business and Technology',
            'code' => 'CBT',
            'is_active' => true,
        ]);

        $course = Course::create([
            'name' => 'Bachelor of Arts in English Language',
            'code' => 'BAEL',
            'organization_id' => $organization->id,
            'status' => 'assigned',
        ]);
        Course::create([
            'name' => 'Unassigned Program',
            'code' => 'PENDING',
            'status' => 'pending',
        ]);
        Course::create([
            'name' => 'Business Program',
            'code' => 'BUS',
            'organization_id' => $otherOrganization->id,
            'status' => 'assigned',
        ]);

        $this->getJson("/api/organizations/{$organization->id}/courses")
            ->assertOk()
            ->assertJsonCount(1, 'courses')
            ->assertJsonPath('courses.0.id', $course->id)
            ->assertJsonPath('courses.0.code', 'BAEL');
    }

    public function test_registration_rejects_a_course_that_is_not_assigned_to_the_selected_organization(): void
    {
        $organization = Organization::create([
            'name' => 'Arts and Sciences',
            'code' => 'CAS',
            'is_active' => true,
        ]);
        $otherOrganization = Organization::create([
            'name' => 'Business and Technology',
            'code' => 'CBT',
            'is_active' => true,
        ]);
        $course = Course::create([
            'name' => 'Business Program',
            'code' => 'BUS',
            'organization_id' => $otherOrganization->id,
            'status' => 'assigned',
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Test Student',
            'email' => 'student@snsu.edu.ph',
            'password' => 'password123',
            'course_id' => $course->id,
            'year_level' => '1st Year',
            'organization_id' => $organization->id,
        ])->assertUnprocessable();

        $this->postJson('/api/auth/register', [
            'name' => 'Another Student',
            'email' => 'another-student@snsu.edu.ph',
            'password' => 'password123',
            'course' => 'A course typed manually',
            'year_level' => '1st Year',
            'organization_id' => $organization->id,
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('voters', ['email' => 'student@snsu.edu.ph']);
        $this->assertDatabaseMissing('voters', ['email' => 'another-student@snsu.edu.ph']);
    }

    public function test_registration_stores_the_admin_added_course_selected_by_id(): void
    {
        $organization = Organization::create([
            'name' => 'Arts and Sciences',
            'code' => 'CAS',
            'is_active' => true,
        ]);
        $course = Course::create([
            'name' => 'Bachelor of Arts in English Language',
            'code' => 'BAEL',
            'organization_id' => $organization->id,
            'status' => 'assigned',
        ]);

        $this->postJson('/api/auth/register', [
            'name' => 'Test Student',
            'email' => 'student@snsu.edu.ph',
            'password' => 'password123',
            'course_id' => $course->id,
            'year_level' => '1st Year',
            'organization_id' => $organization->id,
        ])->assertCreated();

        $this->assertDatabaseHas('voters', [
            'email' => 'student@snsu.edu.ph',
            'course' => $course->name,
            'course_id' => $course->id,
            'organization_id' => $organization->id,
        ]);
    }

    public function test_google_profile_setup_rejects_a_course_from_another_organization(): void
    {
        $organization = Organization::create([
            'name' => 'Arts and Sciences',
            'code' => 'CAS',
            'is_active' => true,
        ]);
        $otherOrganization = Organization::create([
            'name' => 'Business and Technology',
            'code' => 'CBT',
            'is_active' => true,
        ]);
        $course = Course::create([
            'name' => 'Business Program',
            'code' => 'BUS',
            'organization_id' => $otherOrganization->id,
            'status' => 'assigned',
        ]);
        $voter = Voter::create([
            'name' => 'Google Student',
            'email' => 'google-student@snsu.edu.ph',
            'password' => bcrypt('password123'),
            'course' => 'Not Specified',
            'year_level' => '1st Year',
            'is_profile_completed' => false,
        ]);

        Sanctum::actingAs($voter);

        $this->postJson('/api/auth/setup-profile', [
            'name' => 'Google Student',
            'course_id' => $course->id,
            'year_level' => '1st Year',
            'organization_id' => $organization->id,
        ])->assertUnprocessable();
    }
}
