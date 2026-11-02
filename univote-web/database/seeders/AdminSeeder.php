<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Admin;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (empty($email) || empty($password)) {
            $this->command->warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seeding.');
            return;
        }

        if (Admin::where('email', $email)->exists()) {
            $this->command->info('Admin already exists. Skipping...');
            return;
        }

        Admin::create([
            'name' => env('ADMIN_NAME', 'Admin'),
            'email' => $email,
            'password' => Hash::make($password),
        ]);

        $this->command->info('Admin created successfully!');
    }
}