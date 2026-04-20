<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salon_staff', function (Blueprint $table) {
            $table->string('position_title', 128)->nullable()->after('name');
            $table->string('staff_role', 32)->nullable()->after('position_title');
            $table->text('address')->nullable()->after('bio');
            $table->unsignedTinyInteger('age')->nullable()->after('address');
            $table->unsignedSmallInteger('experience_years')->nullable()->after('age');
            $table->string('work_mobile', 32)->nullable()->after('experience_years');
            $table->string('emergency_contact_name', 128)->nullable()->after('work_mobile');
            $table->string('emergency_contact_phone', 32)->nullable()->after('emergency_contact_name');
        });
    }

    public function down(): void
    {
        Schema::table('salon_staff', function (Blueprint $table) {
            $table->dropColumn([
                'position_title',
                'staff_role',
                'address',
                'age',
                'experience_years',
                'work_mobile',
                'emergency_contact_name',
                'emergency_contact_phone',
            ]);
        });
    }
};
