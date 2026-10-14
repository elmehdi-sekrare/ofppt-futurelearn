<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\Module;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Tests\TestCase;

class TeacherImportTest extends TestCase
{
    use RefreshDatabase;

    private const HEADERS = [
        'Niveau', 'Secteur', 'Code Filière', 'filière', 'Type de formation', 'Créneau', 'Groupe', 'Effectif Groupe',
        'Sous Groupe', 'Statut Sous-Groupe', 'FusionGroupe', 'Code Fusion', 'Année de formation', 'Mode',
        'Code Module', 'Module', 'Métier', 'Régional', 'Mle Formateur', 'Formateur Affecté Présentiel Actif 2026-2027',
    ];

    public function test_preview_finds_the_data_sheet_and_groups_rows_by_trainer(): void
    {
        Sanctum::actingAs($this->admin());

        $data = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])
            ->assertOk()
            ->json('data');

        $this->assertSame('AvancementProgramme', $data['sheet']);
        $this->assertSame('2026-2027', $data['academic_year']);
        // "NON AFFECTE" and the trailing totals row ("1") are not trainers.
        $this->assertSame(2, $data['skipped']['unassigned']);

        $names = collect($data['trainers'])->pluck('source_name')->all();
        $this->assertEqualsCanonicalizing(['ABDELGHANI AGHBALOU', 'FAHIM MOHAMED', 'SALMA KARIM'], $names);

        $aghbalou = collect($data['trainers'])->firstWhere('source_name', 'ABDELGHANI AGHBALOU');
        $this->assertSame(['Abdelghani', 'Aghbalou'], [$aghbalou['first_name'], $aghbalou['last_name']]);
        $this->assertSame(['DEV101', 'RVA101'], $aghbalou['groups']);
        // Same module taught to two groups counts once.
        $this->assertSame(['Sport', 'Français'], collect($aghbalou['modules'])->pluck('name')->all());

        // NOM PRÉNOM is turned round and flagged for review.
        $fahim = collect($data['trainers'])->firstWhere('source_name', 'FAHIM MOHAMED');
        $this->assertSame(['Mohamed', 'Fahim', true], [$fahim['first_name'], $fahim['last_name'], $fahim['name_check']]);

        // An account that already exists is matched, whatever the word order.
        $karim = collect($data['trainers'])->firstWhere('source_name', 'SALMA KARIM');
        $this->assertSame('existing', $karim['status']);

        $groups = collect($data['groups'])->keyBy('name');
        $this->assertSame('new', $groups['RVA101']['status']);
        $this->assertSame('Qualification', $groups['RVA101']['degree']);
        $this->assertSame('1ère année', $groups['RVA101']['study_year']);
        $this->assertSame('existing', $groups['DEV101']['status']);
        $this->assertSame('archived', $groups['OLD201']['status']);
    }

    public function test_commit_creates_trainers_groups_and_modules_and_is_safe_to_repeat(): void
    {
        Sanctum::actingAs($this->admin());
        $preview = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->json('data');

        $instructions = collect($preview['trainers'])->map(fn ($trainer) => [
            'index' => $trainer['index'],
            'action' => 'import',
            // The admin corrects a name in the preview before confirming.
            'first_name' => $trainer['source_name'] === 'FAHIM MOHAMED' ? 'Mohamed' : $trainer['first_name'],
            'last_name' => $trainer['source_name'] === 'FAHIM MOHAMED' ? 'Fahim' : $trainer['last_name'],
        ])->values()->all();

        $result = $this->postJson("/api/teacher-imports/{$preview['batch_id']}/commit", ['trainers' => $instructions])
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $result['created']);
        $this->assertSame(1, $result['linked']);
        $this->assertSame(1, $result['groups_created']);   // RVA101; DEV101 already existed
        $this->assertSame(1, $result['groups_reused']);
        $this->assertSame(['OLD201'], $result['groups_archived']);
        $this->assertCount(2, $result['credentials']);
        $this->assertSame('abdelghani.aghbalou@ofppt.com', collect($result['credentials'])->firstWhere('name', 'Abdelghani Aghbalou')['email']);

        // The new group exists, is active and empty, ready for a student list.
        $rva = Group::where('name', 'RVA101')->firstOrFail();
        $this->assertSame('active', $rva->status);
        $this->assertSame('2026-2027', $rva->academic_year);
        $this->assertSame(0, $rva->students()->count());

        // The trainer logs in and sees their groups and matières.
        $trainer = User::where('email', 'abdelghani.aghbalou@ofppt.com')->firstOrFail();
        $this->assertTrue((bool) $trainer->must_change_password);
        Sanctum::actingAs($trainer);
        $this->assertEqualsCanonicalizing(['DEV101', 'RVA101'], collect($this->getJson('/api/groups')->assertOk()->json('data'))->pluck('name')->all());
        $this->assertEqualsCanonicalizing(['Sport', 'Français'], collect($this->getJson('/api/modules')->assertOk()->json('data'))->pluck('name')->all());

        // The archived group was not handed to anyone.
        $this->assertSame(0, Group::where('name', 'OLD201')->firstOrFail()->teachers()->count());

        // Importing the same file again creates nothing new.
        Sanctum::actingAs($this->adminUser);
        $again = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->json('data');
        $this->assertSame(['existing'], collect($again['trainers'])->pluck('status')->unique()->values()->all());
        $teachersBefore = Teacher::count();
        $modulesBefore = Module::count();

        $second = $this->postJson("/api/teacher-imports/{$again['batch_id']}/commit", [
            'trainers' => collect($again['trainers'])->map(fn ($t) => ['index' => $t['index'], 'action' => 'import'])->all(),
        ])->assertOk()->json('data');

        $this->assertSame([0, 3, 0, 0, 0], [$second['created'], $second['linked'], $second['groups_created'], $second['modules_created'], $second['group_links']]);
        $this->assertSame($teachersBefore, Teacher::count());
        $this->assertSame($modulesBefore, Module::count());
        $this->assertSame(1, Group::where('name', 'RVA101')->count());
    }

    public function test_manual_group_assignment_survives_a_reimport(): void
    {
        Sanctum::actingAs($this->admin());
        $preview = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->json('data');
        $this->postJson("/api/teacher-imports/{$preview['batch_id']}/commit", [
            'trainers' => collect($preview['trainers'])->map(fn ($t) => ['index' => $t['index'], 'action' => 'import'])->all(),
        ])->assertOk();

        // The admin later gives Aghbalou an extra group by hand.
        $extra = Group::create(['name' => 'EXTRA101', 'level' => 'Technicien']);
        $teacher = User::where('email', 'abdelghani.aghbalou@ofppt.com')->firstOrFail()->teacher;
        $this->putJson("/api/teachers/{$teacher->id}", [
            'group_ids' => [...$teacher->groups()->pluck('groups.id')->all(), $extra->id],
        ])->assertOk();

        $again = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->json('data');
        $this->postJson("/api/teacher-imports/{$again['batch_id']}/commit", [
            'trainers' => collect($again['trainers'])->map(fn ($t) => ['index' => $t['index'], 'action' => 'import'])->all(),
        ])->assertOk();

        $this->assertTrue($teacher->fresh()->groups()->where('groups.id', $extra->id)->exists());
    }

    public function test_skipped_trainers_are_not_created(): void
    {
        Sanctum::actingAs($this->admin());
        $preview = $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->json('data');

        $this->postJson("/api/teacher-imports/{$preview['batch_id']}/commit", [
            'trainers' => collect($preview['trainers'])->map(fn ($t) => [
                'index' => $t['index'],
                'action' => $t['source_name'] === 'FAHIM MOHAMED' ? 'skip' : 'import',
            ])->all(),
        ])->assertOk()->assertJsonPath('data.skipped', 1);

        $this->assertFalse(User::where('last_name', 'Fahim')->exists());
    }

    public function test_only_admins_can_import_trainers(): void
    {
        $this->admin();
        Sanctum::actingAs(Teacher::first()->user);
        $this->post('/api/teacher-imports/preview', ['file' => $this->workbook()], ['Accept' => 'application/json'])->assertStatus(403);
    }

    public function test_a_file_without_trainer_columns_is_rejected_clearly(): void
    {
        Sanctum::actingAs($this->admin());
        $path = tempnam(sys_get_temp_dir(), 'roster') . '.csv';
        file_put_contents($path, "Nom,Prénom,CIN\nAlami,Sara,AB123\n");

        $this->post('/api/teacher-imports/preview', ['file' => new UploadedFile($path, 'liste.csv', 'text/csv', null, true)], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'No sheet with Groupe, Module and Formateur columns was found in this file.');
    }

    // ── fixtures ────────────────────────────────────────────────────────

    private User $adminUser;

    private function admin(): User
    {
        $this->adminUser = User::create(['first_name' => 'Admin', 'last_name' => 'Import', 'email' => 'admin.import@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);

        // An existing trainer, stored in the opposite word order to the file.
        $karim = User::create(['first_name' => 'Karim', 'last_name' => 'Salma', 'email' => 'karim.salma@ofppt.test', 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        Teacher::create(['user_id' => $karim->id]);

        Group::create(['name' => 'DEV101', 'level' => 'Technicien Spécialisé']);
        Group::create(['name' => 'OLD201', 'level' => 'Technicien', 'status' => 'archived']);

        return $this->adminUser;
    }

    private function workbook(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'affectation') . '.xlsx';
        $writer = new Writer();
        $writer->openToFile($path);

        // The official file opens on pivot tables; the reader must look past them.
        $writer->getCurrentSheet()->setName('MH FOR');
        $writer->addRow(Row::fromValues(['Étiquettes de lignes', 'Somme de MH Affectée Présentiel']));
        $writer->addRow(Row::fromValues(['ABDELGHANI AGHBALOU', 960]));

        $writer->addNewSheetAndMakeItCurrent()->setName('AvancementProgramme');
        $writer->addRow(Row::fromValues(self::HEADERS));
        $rows = [
            ['Q', 'RVA101', 1, 'EGQ107', 'Sport', 'ABDELGHANI AGHBALOU'],
            ['TS', 'DEV101', 2, 'EGQ107', 'Sport', 'ABDELGHANI AGHBALOU'],
            ['TS', 'DEV101', 2, 'EGQ102', 'Français', 'ABDELGHANI AGHBALOU'],
            ['TS', 'DEV101', 2, 'M201', 'Programmation web', 'FAHIM MOHAMED'],
            ['TS', 'DEV101', 2, 'M202', 'Bases de données', 'SALMA KARIM'],
            ['T', 'OLD201', 2, 'M301', 'Gestion de projet', 'SALMA KARIM'],
            ['Q', 'RVA101', 1, 'EGQ102', 'Français', 'NON AFFECTE'],
        ];
        foreach ($rows as [$level, $group, $year, $code, $module, $trainer]) {
            $writer->addRow(Row::fromValues([
                $level, 'Secteur', 'CODE', 'Filière', 'Diplômante', 'CDJ', $group, '20',
                $group, 'Actif', '', '0', $year, 'Résidentiel',
                $code, $module, 'Métier', 'N', '', $trainer,
            ]));
        }
        // The real workbook ends with a totals row.
        $writer->addRow(Row::fromValues(array_merge(array_fill(0, 19, null), [1])));
        $writer->close();

        return new UploadedFile($path, 'Affectation 2026-2027.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }
}
