<?php

namespace App\Services;

use App\Models\Module;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;
use ZipArchive;

class ImportFileReader
{
    private const MAX_ROWS = 1000;

    public function studentRows(UploadedFile $file): array
    {
        $rows = $this->read($file);
        if (count($rows) < 2) throw new RuntimeException('The roster must contain a header row and at least one student.');

        $headers = array_map(fn ($value) => $this->header($value), array_shift($rows));
        $cinColumn = $this->column($headers, ['cin', 'cne', 'cin cne']);
        $firstNameColumn = $this->column($headers, ['first name', 'firstname', 'prenom', 'prénom']);
        $lastNameColumn = $this->column($headers, ['last name', 'lastname', 'nom']);
        $fullNameColumn = $this->column($headers, ['nom prenom', 'full name', 'fullname', 'student name', 'name']);

        if ($cinColumn === null || ($fullNameColumn === null && ($firstNameColumn === null || $lastNameColumn === null))) {
            throw new RuntimeException('Use CIN/CNE plus First name and Last name, or Nom & Prénom.');
        }

        $result = [];
        $seen = [];
        $existing = Student::query()
            ->with('user')
            ->whereIn('cne', collect($rows)->map(fn ($row) => $this->cin($row[$cinColumn] ?? ''))->filter()->unique())
            ->get()
            ->keyBy('cne');

        foreach ($rows as $offset => $row) {
            if (count($result) >= self::MAX_ROWS) throw new RuntimeException('A single import is limited to ' . self::MAX_ROWS . ' rows.');
            if ($this->emptyRow($row)) continue;

            $cin = $this->cin($row[$cinColumn] ?? '');
            $firstName = $firstNameColumn === null ? '' : $this->value($row[$firstNameColumn] ?? '');
            $lastName = $lastNameColumn === null ? '' : $this->value($row[$lastNameColumn] ?? '');
            $nameWarning = false;

            if ($fullNameColumn !== null && ($firstName === '' || $lastName === '')) {
                [$firstName, $lastName, $nameWarning] = $this->splitFullName($this->value($row[$fullNameColumn] ?? ''));
            }

            $entry = [
                'index' => $offset,
                'source_row' => $offset + 2,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'cne' => $cin,
                'status' => 'new',
                'message' => $nameWarning ? 'Please verify the name split before importing.' : null,
                'existing_student_id' => null,
            ];

            if ($cin === '' || !preg_match('/^[A-Z0-9-]{3,20}$/', $cin)) {
                $entry['status'] = 'invalid';
                $entry['message'] = 'A valid CIN/CNE is required.';
            } elseif ($firstName === '' || $lastName === '') {
                $entry['status'] = 'invalid';
                $entry['message'] = 'Both first and last name are required.';
            } elseif (isset($seen[$cin])) {
                $entry['status'] = 'invalid';
                $entry['message'] = 'This CIN/CNE appears more than once in the file.';
            } elseif ($student = $existing->get($cin)) {
                $entry['existing_student_id'] = $student->id;
                $entry['status'] = 'duplicate_allowed';
                $entry['message'] = 'Existing student: importing adds them to this group without creating a duplicate.';
            }

            $seen[$cin] = true;
            $result[] = $entry;
        }

        if ($result === []) throw new RuntimeException('No student rows were found in the uploaded file.');
        return $result;
    }

    public function moduleRows(UploadedFile $file, Teacher $teacher): array
    {
        $rows = $this->read($file);
        if (count($rows) < 2) throw new RuntimeException('The module list must contain a header row and at least one module.');

        $headers = array_map(fn ($value) => $this->header($value), array_shift($rows));
        $nameColumn = $this->column($headers, ['module', 'module name', 'subject', 'subject name', 'name']) ?? 0;
        $existing = $teacher->modules()->pluck('id', 'name')->mapWithKeys(fn ($id, $name) => [mb_strtolower($name) => $id]);
        $seen = [];
        $result = [];

        foreach ($rows as $offset => $row) {
            if (count($result) >= self::MAX_ROWS) throw new RuntimeException('A single import is limited to ' . self::MAX_ROWS . ' rows.');
            $name = $this->value($row[$nameColumn] ?? '');
            if ($name === '') continue;
            $key = mb_strtolower($name);
            $status = 'new';
            $message = null;
            if (mb_strlen($name) > 100) {
                $status = 'invalid';
                $message = 'Module names may not exceed 100 characters.';
            } elseif (isset($seen[$key])) {
                $status = 'duplicate';
                $message = 'This module appears more than once in the file.';
            } elseif ($existing->has($key)) {
                $status = 'duplicate';
                $message = 'You already have this module.';
            }
            $seen[$key] = true;
            $result[] = ['index' => $offset, 'source_row' => $offset + 2, 'name' => $name, 'status' => $status, 'message' => $message];
        }

        if ($result === []) throw new RuntimeException('No module rows were found in the uploaded file.');
        return $result;
    }

    private function read(UploadedFile $file): array
    {
        return match (strtolower($file->getClientOriginalExtension())) {
            'csv', 'txt' => $this->readCsv($file->getRealPath()),
            'xlsx' => $this->readXlsx($file->getRealPath()),
            'docx' => $this->readDocx($file->getRealPath()),
            default => throw new RuntimeException('Only CSV, XLSX, and DOCX files are supported.'),
        };
    }

    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if (!$handle) throw new RuntimeException('The CSV file could not be read.');
        $sample = fgets($handle) ?: '';
        rewind($handle);
        $delimiter = substr_count($sample, ';') > substr_count($sample, ',') ? ';' : ',';
        $rows = [];
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) $rows[] = $row;
        fclose($handle);
        return $rows;
    }

    private function readXlsx(string $path): array
    {
        $reader = new XlsxReader();
        $reader->open($path);
        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                $rows = [];
                foreach ($sheet->getRowIterator() as $row) $rows[] = $row->toArray();
                if ($rows !== []) return $rows;
            }
        } finally {
            $reader->close();
        }
        return [];
    }

    private function readDocx(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) throw new RuntimeException('The DOCX file could not be opened.');
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (!$xml) throw new RuntimeException('The DOCX file does not contain a readable document.');

        $document = new \DOMDocument();
        if (!@$document->loadXML($xml)) throw new RuntimeException('The DOCX document is invalid.');
        $xpath = new \DOMXPath($document);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $rows = [];
        foreach ($xpath->query('//w:tbl/w:tr') as $tableRow) {
            $cells = [];
            foreach ($xpath->query('./w:tc', $tableRow) as $cell) {
                $text = '';
                foreach ($xpath->query('.//w:t', $cell) as $node) $text .= $node->textContent;
                $cells[] = $text;
            }
            if ($cells !== []) $rows[] = $cells;
        }
        return $rows;
    }

    private function column(array $headers, array $candidates): ?int
    {
        foreach ($candidates as $candidate) {
            $position = array_search($this->header($candidate), $headers, true);
            if ($position !== false) return $position;
        }
        return null;
    }

    private function header(mixed $value): string
    {
        $value = ltrim($this->value($value), "\xEF\xBB\xBF");
        return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9]+/', ' ', strtolower(Str::ascii($value)))));
    }

    private function value(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) return $value->format('Y-m-d');
        return trim(preg_replace('/\s+/', ' ', (string) $value));
    }

    private function cin(mixed $value): string
    {
        return strtoupper(str_replace(' ', '', $this->value($value)));
    }

    private function splitFullName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        if (count($parts) < 2) return ['', '', false];
        $firstName = array_pop($parts);
        return [$firstName, implode(' ', $parts), count($parts) > 1];
    }

    private function emptyRow(array $row): bool
    {
        return collect($row)->every(fn ($value) => $this->value($value) === '');
    }
}
