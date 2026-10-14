<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentListImportTest extends TestCase
{
    use RefreshDatabase;

    private const HEADERS = [
        'id_inscriptionsessionprogramme', 'MatriculeEtudiant', 'Nom', 'Prenom', 'Sexe', 'EtudiantActif',
        'LibelleLong', 'CodeDiplome', 'codediplome1', 'prenom2', 'CIN', 'anneeEtude',
    ];

    public function test_preview_groups_the_mixed_list_by_code_diplome(): void
    {
        $this->seedSchool();

        $data = $this->post('/api/student-list-imports/preview', ['file' => $this->exportFile()], ['Accept' => 'application/json'])
            ->assertOk()
            ->json('data');

        $this->assertSame('Export', $data['sheet']);
        $this->assertSame('2026-2027', $data['academic_year']);

        $groups = collect($data['groups'])->keyBy('key');
        $this->assertSame(['DEV101', 'MA101', 'OLD201'], $groups->keys()->all());

        // A new group takes its diploma, year and filière from LibelleLong.
        $this->assertSame('new', $groups['MA101']['status']);
        $this->assertSame('Spécialisation', $groups['MA101']['degree']);
        $this->assertSame('1ère année', $groups['MA101']['study_year']);
        $this->assertSame('2026-2027', $groups['MA101']['academic_year']);
        $this->assertSame('Menuiserie Aluminium', $groups['MA101']['filiere']);
        $this->assertSame(2, $groups['MA101']['new_students']);

        // "DEV101" in the file is the existing "dev 101" group.
        $this->assertSame('existing', $groups['DEV101']['status']);
        $this->assertSame('dev 101', $groups['DEV101']['name']);
        $this->assertSame(1, $groups['DEV101']['existing_students']);
        $this->assertSame(1, $groups['DEV101']['unchanged_students']);
        $this->assertSame('archived', $groups['OLD201']['status']);

        $students = collect($data['students'])->keyBy('last_name');
        // No CIN: the matricule identifies the student instead.
        $this->assertSame('2009082900035', $students['RAMI']['cne']);
        $this->assertSame('existing', $students['BENANI']['status']);
        $this->assertSame(['dev 405'], $students['BENANI']['current_groups']);
        $this->assertSame('unchanged', $students['ALAOUI']['status']);

        $this->assertEqualsCanonicalizing(['inactive', 'duplicate', 'missing_group'], collect($data['skipped'])->pluck('reason')->all());
    }

    public function test_commit_creates_groups_and_students_and_is_safe_to_repeat(): void
    {
        $this->seedSchool();
        $preview = $this->post('/api/student-list-imports/preview', ['file' => $this->exportFile()], ['Accept' => 'application/json'])->json('data');

        $result = $this->postJson("/api/student-list-imports/{$preview['batch_id']}/commit", [])
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $result['groups_created']);
        $this->assertSame(1, $result['groups_reused']);
        $this->assertSame(['OLD201'], $result['groups_archived']);
        $this->assertSame(2, $result['students_created']);
        $this->assertSame(1, $result['students_added']);
        $this->assertSame(1, $result['students_unchanged']);
        $this->assertSame(1, $result['skipped']);
        $this->assertCount(2, $result['credentials']);
        $this->assertSame('MA101', $result['credentials'][0]['group']);

        $ma101 = Group::where('name', 'MA101')->firstOrFail();
        $this->assertSame(['Spécialisation', '1ère année', '2026-2027', 'active'], [$ma101->degree, $ma101->study_year, $ma101->academic_year, $ma101->status]);

        $rami = Student::with(['user', 'groups'])->where('cne', '2009082900035')->firstOrFail();
        $this->assertSame(['YOUSSEF', 'RAMI'], [$rami->user->first_name, $rami->user->last_name]);
        $this->assertSame('youssef.rami@ofppt.com', $rami->user->email);
        $this->assertTrue($rami->user->must_change_password);
        $this->assertSame(['MA101'], $rami->groups->pluck('name')->all());
        $this->assertTrue(Hash::check('password123', $rami->user->password));

        // An existing student joins the new group and keeps the old one.
        $benani = Student::with('groups')->where('cne', 'BK123456')->firstOrFail();
        $this->assertEqualsCanonicalizing(['dev 405', 'dev 101'], $benani->groups->pluck('name')->all());
        $this->assertSame(Group::where('name', 'dev 101')->value('id'), $benani->group_id);

        // Nobody is added to an archived group.
        $this->assertSame(0, Group::where('name', 'OLD201')->firstOrFail()->students()->count());

        // The same file again changes nothing.
        $again = $this->post('/api/student-list-imports/preview', ['file' => $this->exportFile()], ['Accept' => 'application/json'])->json('data');
        $repeat = $this->postJson("/api/student-list-imports/{$again['batch_id']}/commit", [])->assertOk()->json('data');
        $this->assertSame([0, 0, 0, 4], [$repeat['groups_created'], $repeat['students_created'], $repeat['students_added'], $repeat['students_unchanged']]);
        $this->assertSame(1, Group::where('name', 'MA101')->count());
    }

    public function test_excluded_groups_are_neither_created_nor_filled(): void
    {
        $this->seedSchool();
        $preview = $this->post('/api/student-list-imports/preview', ['file' => $this->exportFile()], ['Accept' => 'application/json'])->json('data');

        $result = $this->postJson("/api/student-list-imports/{$preview['batch_id']}/commit", ['exclude_groups' => ['MA101']])
            ->assertOk()
            ->json('data');

        $this->assertSame(0, $result['groups_created']);
        $this->assertSame(0, $result['students_created']);
        $this->assertFalse(Group::where('name', 'MA101')->exists());
        $this->assertFalse(Student::where('cne', '2009082900035')->exists());
    }

    public function test_binary_xls_files_get_a_clear_message(): void
    {
        $this->seedSchool();
        $file = UploadedFile::fake()->createWithContent('lister.xls', "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1" . str_repeat("\0", 512));

        $this->post('/api/student-list-imports/preview', ['file' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This is an Excel 97-2003 binary file. Open it in Excel, save it as .xlsx, and upload it again.');
    }

    public function test_only_admins_can_import(): void
    {
        $student = User::create(['first_name' => 'S', 'last_name' => 'T', 'email' => 's.t@ofppt.test', 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        Sanctum::actingAs($student);

        $this->post('/api/student-list-imports/preview', ['file' => $this->exportFile()], ['Accept' => 'application/json'])->assertForbidden();
    }

    private function seedSchool(): void
    {
        Sanctum::actingAs(User::create(['first_name' => 'Admin', 'last_name' => 'Import', 'email' => 'admin.list@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]));

        $dev405 = Group::create(['name' => 'dev 405', 'level' => 'Qualification']);
        $dev101 = Group::create(['name' => 'dev 101', 'level' => 'Technicien Spécialisé']);
        Group::create(['name' => 'OLD201', 'level' => 'Technicien', 'status' => 'archived']);

        $benani = User::create(['first_name' => 'SARA', 'last_name' => 'BENANI', 'email' => 'sara.benani@ofppt.com', 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        Student::create(['user_id' => $benani->id, 'cne' => 'BK123456', 'group_id' => $dev405->id]);
        $alaoui = User::create(['first_name' => 'OMAR', 'last_name' => 'ALAOUI', 'email' => 'omar.alaoui@ofppt.com', 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        Student::create(['user_id' => $alaoui->id, 'cne' => 'BH654321', 'group_id' => $dev101->id]);
    }

    /** The OFPPT export: an Excel 2003 XML spreadsheet saved as .xls, groups mixed together. */
    private function exportFile(): UploadedFile
    {
        $rows = [
            ['6806775', '2009082900035', 'RAMI', 'YOUSSEF', 'M', 'Oui', 'BTP_MA_S_1A-Menuiserie Aluminium (1A)-2026', 'MA101', '', '', '', '1ère année'],
            ['6806776', '2007011600098', 'BENANI', 'SARA', 'F', 'Oui', 'DIA_DEV_TS_1A-Développement Digital (1A)-2026', 'DEV101', '', '', 'BK123456', '1ère année'],
            ['6806777', '2008011600011', 'ALAOUI', 'OMAR', 'M', 'Oui', 'DIA_DEV_TS_1A-Développement Digital (1A)-2026', 'DEV101', '', '', 'BH654321', '1ère année'],
            ['6806778', '2008011600012', 'KABBOURI', 'MOHAMED-AMINE', 'M', 'Oui', 'BTP_MA_S_1A-Menuiserie Aluminium (1A)-2026', 'MA101', '', '', 'BJ111222', '1ère année'],
            ['6806779', '2008011600013', 'TAZI', 'NADIA', 'F', 'Oui', 'GC_AAOC_T_2A-Assistant Administratif option Commerce (2A)-2026', 'OLD201', '', '', 'BJ333444', '2ème année'],
            ['6806780', '2008011600014', 'IDRISSI', 'HAMZA', 'M', 'Non', 'BTP_MA_S_1A-Menuiserie Aluminium (1A)-2026', 'MA101', '', '', 'BJ555666', '1ère année'],
            ['6806781', '2008011600015', 'KABBOURI', 'AMINE', 'M', 'Oui', 'BTP_MA_S_1A-Menuiserie Aluminium (1A)-2026', 'MA101', '', '', 'BJ111222', '1ère année'],
            ['6806782', '2008011600016', 'ZIANI', 'LINA', 'F', 'Oui', '', '', '', '', 'BJ777888', '1ère année'],
        ];

        $cell = fn (string $value) => '<Cell><Data ss:Type="String">' . htmlspecialchars($value, ENT_XML1) . '</Data></Cell>';
        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'
            . '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
            . '<Worksheet ss:Name="Export"><Table>'
            . '<Row>' . implode('', array_map($cell, self::HEADERS)) . '</Row>';
        foreach ($rows as $row) {
            // Empty cells are left out and the next one carries ss:Index, as Excel writes them.
            $xml .= '<Row>';
            $skipped = false;
            foreach ($row as $position => $value) {
                if ($value === '') { $skipped = true; continue; }
                $xml .= $skipped ? str_replace('<Cell>', '<Cell ss:Index="' . ($position + 1) . '">', $cell($value)) : $cell($value);
                $skipped = false;
            }
            $xml .= '</Row>';
        }
        $xml .= '</Table></Worksheet></Workbook>';

        return UploadedFile::fake()->createWithContent('lister - 2026-10-13T180720.111.xls', $xml);
    }
}
