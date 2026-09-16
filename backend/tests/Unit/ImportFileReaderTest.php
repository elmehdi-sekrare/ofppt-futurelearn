<?php

namespace Tests\Unit;

use App\Models\Group;
use App\Models\Teacher;
use App\Models\User;
use App\Services\ImportFileReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use ZipArchive;

class ImportFileReaderTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reads_xlsx_and_docx_roster_tables(): void
    {
        $teacher = $this->teacher();
        $reader = app(ImportFileReader::class);
        $xlsx = $this->xlsx();
        $docx = $this->docx();

        try {
            $xlsxRows = $reader->studentRows(new UploadedFile($xlsx, 'roster.xlsx', null, null, true), $teacher);
            $docxRows = $reader->studentRows(new UploadedFile($docx, 'roster.docx', null, null, true), $teacher);
            $this->assertSame('TA100001', $xlsxRows[0]['cne']);
            $this->assertSame('TA100002', $docxRows[0]['cne']);
        } finally {
            @unlink($xlsx);
            @unlink($docx);
        }
    }

    private function teacher(): Teacher
    {
        $group = Group::create(['name' => 'DEV-TEST', 'level' => 'Test']);
        $user = User::create(['first_name' => 'Teacher', 'last_name' => 'Test', 'email' => 'reader@ofppt.test', 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        $teacher = Teacher::create(['user_id' => $user->id]);
        $teacher->groups()->attach($group->id);
        return $teacher;
    }

    private function xlsx(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'roster-') . '.xlsx';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>First name</t></is></c><c r="B1" t="inlineStr"><is><t>Last name</t></is></c><c r="C1" t="inlineStr"><is><t>CIN</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>First</t></is></c><c r="B2" t="inlineStr"><is><t>Student</t></is></c><c r="C2" t="inlineStr"><is><t>TA100001</t></is></c></row></sheetData></worksheet>');
        $zip->close();
        return $path;
    }

    private function docx(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'roster-') . '.docx';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Nom &amp; Prénom</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cin</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Student Second</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>TA100002</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>');
        $zip->close();
        return $path;
    }
}
