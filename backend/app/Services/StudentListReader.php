<?php

namespace App\Services;

use App\Models\Group;
use App\Models\Student;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;
use XMLReader;

/**
 * Reads the institution-wide student export ("lister - <date>.xls") where
 * every row is one student and the CodeDiplome column names their group,
 * with groups mixed together in any order.
 *
 * The export is usually an Excel 2003 XML spreadsheet saved with a .xls
 * extension, so the format is detected from the file's content. Nothing is
 * written here: the result is a preview matched against existing groups and
 * students, committed later by ImportController::commitStudentList.
 */
class StudentListReader
{
    private const MAX_ROWS = 5000;
    private const HEADER_SCAN_ROWS = 10;
    private const SPREADSHEET_NS = 'urn:schemas-microsoft-com:office:spreadsheet';

    public function read(UploadedFile $file): array
    {
        $table = $this->locateTable($file);
        $columns = $table['columns'];

        $students = [];
        $groups = [];
        $skipped = [];
        $seenCin = [];
        $seenMatricule = [];
        $dataRows = 0;

        foreach ($table['rows'] as [$sourceRow, $row]) {
            if ($this->emptyRow($row)) continue;
            if (++$dataRows > self::MAX_ROWS) {
                throw new RuntimeException('A single import is limited to ' . self::MAX_ROWS . ' students.');
            }

            $lastName = $this->value($row[$columns['last_name']] ?? '');
            $firstName = $this->value($row[$columns['first_name']] ?? '');
            $groupName = $this->value($row[$columns['group']] ?? '');
            $cin = $this->identifier($columns['cin'] === null ? '' : ($row[$columns['cin']] ?? ''));
            $matricule = $this->identifier($columns['matricule'] === null ? '' : ($row[$columns['matricule']] ?? ''));
            $reason = match (true) {
                $columns['active'] !== null && $this->isNo($row[$columns['active']] ?? '') => 'inactive',
                $groupName === '' => 'missing_group',
                mb_strlen($groupName) > 50 || self::groupKey($groupName) === '' => 'invalid_group',
                $firstName === '' || $lastName === '' || mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100 => 'missing_name',
                $cin === '' && $matricule === '' => 'missing_identifier',
                ($cin !== '' && isset($seenCin[$cin])) || ($matricule !== '' && isset($seenMatricule[$matricule])) => 'duplicate',
                default => null,
            };
            if ($reason !== null) {
                $skipped[] = ['source_row' => $sourceRow, 'name' => trim("{$lastName} {$firstName}"), 'group' => $groupName, 'reason' => $reason];
                continue;
            }

            if ($cin !== '') $seenCin[$cin] = true;
            if ($matricule !== '') $seenMatricule[$matricule] = true;

            $groupKey = self::groupKey($groupName);
            if (!isset($groups[$groupKey])) {
                $label = $this->value($columns['label'] === null ? '' : ($row[$columns['label']] ?? ''));
                $groups[$groupKey] = [
                    'key' => $groupKey,
                    'name' => $groupName,
                    'degree' => $this->degreeFrom($label),
                    'study_year' => $this->studyYear($columns['year'] === null ? '' : ($row[$columns['year']] ?? ''), $label),
                    'academic_year' => $this->academicYearFromLabel($label),
                    'filiere' => $this->filiereFrom($label),
                ];
            }

            $students[] = [
                'index' => count($students),
                'source_row' => $sourceRow,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'cin' => $cin,
                'matricule' => $matricule,
                // The app identifies students by CIN; the matricule stands in
                // for the students the export lists without one.
                'cne' => $cin !== '' ? $cin : $matricule,
                'group' => $groupKey,
            ];
        }

        if ($students === []) {
            throw new RuntimeException('No student rows were found. Check that the sheet has Nom, Prenom and CodeDiplome columns.');
        }

        $academicYears = array_count_values(array_filter(array_column($groups, 'academic_year')));
        arsort($academicYears);
        $academicYear = array_key_first($academicYears) ?? $this->currentAcademicYear();

        $students = $this->resolveStudents($students);

        return [
            'sheet' => $table['sheet'],
            'academic_year' => $academicYear,
            'rows' => $dataRows,
            'students' => $students,
            'groups' => $this->resolveGroups($groups, $students, $academicYear),
            'skipped' => $skipped,
        ];
    }

    /** Spaces, dashes and case do not make a different group: "dev 101" is DEV101. */
    public static function groupKey(string $name): string
    {
        return mb_strtoupper(preg_replace('/[^\p{L}\p{N}]+/u', '', $name) ?? '');
    }

    // ── Locating the data ─────────────────────────────────────────────

    /** @return array{sheet: string, columns: array<string,int|null>, rows: array<int, array{0:int,1:array}>} */
    private function locateTable(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $head = (string) file_get_contents($path, false, null, 0, 2048);

        if (str_starts_with($head, "PK\x03\x04")) {
            $reader = new XlsxReader();
            try {
                $reader->open($path);
            } catch (\Throwable) {
                throw new RuntimeException('The Excel file could not be opened.');
            }
            try {
                foreach ($reader->getSheetIterator() as $sheet) {
                    $table = $this->findTable($sheet->getName(), $sheet->getRowIterator());
                    if ($table) return $table;
                }
            } finally {
                $reader->close();
            }
        } elseif (str_starts_with($head, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")) {
            throw new RuntimeException('This is an Excel 97-2003 binary file. Open it in Excel, save it as .xlsx, and upload it again.');
        } elseif (str_contains($head, self::SPREADSHEET_NS) || preg_match('/<\s*(ss:)?Workbook\b/i', $head)) {
            foreach ($this->readSpreadsheetXml($path) as $name => $rows) {
                $table = $this->findTable($name, $rows);
                if ($table) return $table;
            }
        } elseif (in_array(strtolower($file->getClientOriginalExtension()), ['csv', 'txt'], true)) {
            $table = $this->findTable('CSV', $this->readCsv($path));
            if ($table) return $table;
        } else {
            throw new RuntimeException('Only Excel (.xls, .xlsx) and CSV files are supported for student lists.');
        }

        throw new RuntimeException('No sheet with Nom, Prenom and CodeDiplome columns was found in this file.');
    }

    private function findTable(string $sheet, iterable $rows): ?array
    {
        $columns = null;
        $data = [];
        $position = 0;

        foreach ($rows as $row) {
            $position++;
            $cells = is_array($row) ? $row : $row->toArray();

            if ($columns === null) {
                if ($position > self::HEADER_SCAN_ROWS) return null;
                $columns = $this->matchColumns(array_map(fn ($value) => $this->header($value), $cells));
                continue;
            }

            $data[] = [$position, $cells];
        }

        return $columns === null ? null : ['sheet' => $sheet, 'columns' => $columns, 'rows' => $data];
    }

    /** @return array<string, int|null>|null */
    private function matchColumns(array $headers): ?array
    {
        $columns = [
            'group' => $this->exact($headers, ['codediplome', 'code diplome', 'groupe', 'group', 'code groupe', 'nom groupe']),
            'last_name' => $this->exact($headers, ['nom', 'last name', 'lastname', 'nom de famille']),
            'first_name' => $this->exact($headers, ['prenom', 'first name', 'firstname']),
            'cin' => $this->exact($headers, ['cin', 'cne', 'cin cne']),
            'matricule' => $this->exact($headers, ['matriculeetudiant', 'matricule etudiant', 'matricule', 'cef']),
            'label' => $this->exact($headers, ['libellelong', 'libelle long', 'libelle']),
            'year' => $this->exact($headers, ['anneeetude', 'annee etude', 'annee de formation', 'annee']),
            'active' => $this->exact($headers, ['etudiantactif', 'etudiant actif', 'actif']),
        ];

        if ($columns['group'] === null || $columns['last_name'] === null || $columns['first_name'] === null) return null;
        if ($columns['cin'] === null && $columns['matricule'] === null) return null;

        return $columns;
    }

    /**
     * Streams an Excel 2003 XML spreadsheet into [sheet name => rows].
     * Cells may skip columns (ss:Index) or span several (ss:MergeAcross).
     *
     * @return array<string, array<int, array<int, string>>>
     */
    private function readSpreadsheetXml(string $path): array
    {
        $reader = new XMLReader();
        if (!$reader->open($path, null, LIBXML_NONET | LIBXML_COMPACT)) {
            throw new RuntimeException('The spreadsheet could not be opened.');
        }

        $sheets = [];
        $sheet = 'Sheet1';
        $row = null;
        $column = 0;
        $cellColumn = 0;

        try {
            while (@$reader->read()) {
                $element = $reader->nodeType === XMLReader::ELEMENT;
                $end = $reader->nodeType === XMLReader::END_ELEMENT;

                if ($element && $reader->localName === 'Worksheet') {
                    $sheet = $reader->getAttributeNs('Name', self::SPREADSHEET_NS) ?: 'Sheet' . (count($sheets) + 1);
                    $sheets[$sheet] = [];
                } elseif ($element && $reader->localName === 'Row') {
                    $row = [];
                    $column = 0;
                    if ($reader->isEmptyElement) { $sheets[$sheet][] = []; $row = null; }
                } elseif ($end && $reader->localName === 'Row' && $row !== null) {
                    $sheets[$sheet][] = $this->denseRow($row);
                    $row = null;
                } elseif ($element && $reader->localName === 'Cell' && $row !== null) {
                    $index = (int) $reader->getAttributeNs('Index', self::SPREADSHEET_NS);
                    if ($index > 0) $column = $index - 1;
                    $cellColumn = $column;
                    $column += 1 + (int) $reader->getAttributeNs('MergeAcross', self::SPREADSHEET_NS);
                } elseif ($element && $reader->localName === 'Data' && $row !== null) {
                    $row[$cellColumn] = $reader->readString();
                }
            }
        } finally {
            $reader->close();
        }

        if ($sheets === []) throw new RuntimeException('The spreadsheet does not contain any worksheet.');
        return $sheets;
    }

    private function denseRow(array $cells): array
    {
        if ($cells === []) return [];
        $row = array_fill(0, max(array_keys($cells)) + 1, '');
        foreach ($cells as $position => $value) $row[$position] = $value;
        return $row;
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

    // ── Matching against the database ─────────────────────────────────

    /**
     * Marks each student as new, already in the group from the file
     * ("unchanged"), or existing elsewhere and about to join it ("existing").
     * A student is recognised by CIN, or by matricule for those without one.
     */
    private function resolveStudents(array $students): array
    {
        $identifiers = collect($students)->flatMap(fn ($student) => [$student['cin'], $student['matricule']])->filter()->unique();
        $existing = $identifiers->chunk(500)
            ->flatMap(fn ($chunk) => Student::query()->with('groups:id,name')->whereIn('cne', $chunk->values())->get())
            ->keyBy('cne');

        foreach ($students as &$student) {
            $match = ($student['cin'] !== '' ? $existing->get($student['cin']) : null)
                ?? ($student['matricule'] !== '' ? $existing->get($student['matricule']) : null);

            $student['existing_student_id'] = $match?->id;
            $student['current_groups'] = [];
            $student['status'] = 'new';
            if (!$match) continue;

            $current = $match->groups->pluck('name')->all();
            $alreadyThere = collect($current)->contains(fn ($name) => self::groupKey($name) === $student['group']);
            $student['status'] = $alreadyThere ? 'unchanged' : 'existing';
            $student['current_groups'] = $current;
        }

        return $students;
    }

    private function resolveGroups(array $groups, array $students, string $academicYear): array
    {
        $existing = Group::query()->get()->keyBy(fn (Group $group) => self::groupKey($group->name));
        $counts = [];
        foreach ($students as $student) {
            $counts[$student['group']][$student['status']] = ($counts[$student['group']][$student['status']] ?? 0) + 1;
        }

        $result = [];
        foreach ($groups as $key => $group) {
            $match = $existing->get($key);
            $result[] = [
                'key' => $key,
                'name' => $match?->name ?? $group['name'],
                'degree' => $match ? ($match->degree ?? $match->level) : $group['degree'],
                'study_year' => $match ? $match->study_year : $group['study_year'],
                'academic_year' => $match ? $match->academic_year : ($group['academic_year'] ?? $academicYear),
                'filiere' => $group['filiere'],
                'student_count' => array_sum($counts[$key] ?? []),
                'new_students' => $counts[$key]['new'] ?? 0,
                'existing_students' => $counts[$key]['existing'] ?? 0,
                'unchanged_students' => $counts[$key]['unchanged'] ?? 0,
                'status' => !$match ? 'new' : (($match->status ?? 'active') === 'archived' ? 'archived' : 'existing'),
                'existing_group_id' => $match?->id,
            ];
        }

        usort($result, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
        return $result;
    }

    // ── Reading the programme label ───────────────────────────────────
    // LibelleLong looks like "BTP_MA_S_1A-Menuiserie Aluminium (1A)-2026":
    // sector, filière code, level code, year of study, then the title and
    // the year the cohort started.

    private function degreeFrom(string $label): string
    {
        $prefix = explode('-', $label, 2)[0];
        if (preg_match('/_([A-Z]{1,2})_\d+A$/i', $prefix, $m)) {
            $code = strtoupper($m[1]);
            return AssignmentWorkbookReader::DEGREES[$code] ?? $code;
        }
        return 'Non précisé';
    }

    private function filiereFrom(string $label): ?string
    {
        if (preg_match('/^[^-]+-(.+?)\s*\(\d+\s*A\)/iu', $label, $m)) return Str::limit(trim($m[1]), 120, '…');
        return null;
    }

    private function studyYear(mixed $value, string $label): ?string
    {
        if (preg_match('/[1-3]/', $this->value($value), $m)) $year = (int) $m[0];
        elseif (preg_match('/_(\d)A\b/i', $label, $m)) $year = (int) $m[1];
        else return null;

        return match ($year) {
            1 => '1ère année',
            2 => '2ème année',
            3 => '3ème année',
            default => null,
        };
    }

    private function academicYearFromLabel(string $label): ?string
    {
        if (preg_match('/-\s*(20\d{2})\s*$/', $label, $m)) return $m[1] . '-' . ((int) $m[1] + 1);
        return null;
    }

    /** September starts a new academic year. */
    private function currentAcademicYear(): string
    {
        $year = (int) now()->format('Y');
        $start = (int) now()->format('n') >= 9 ? $year : $year - 1;
        return $start . '-' . ($start + 1);
    }

    // ── Small parsing helpers ─────────────────────────────────────────

    /** CIN and matricule: upper case, no spaces, and "." or "-" alone means empty. */
    private function identifier(mixed $value): string
    {
        $value = strtoupper(str_replace(' ', '', $this->value($value)));
        return preg_match('/^[A-Z0-9-]{3,20}$/', $value) ? $value : '';
    }

    private function isNo(mixed $value): bool
    {
        return in_array(mb_strtolower(Str::ascii($this->value($value))), ['non', 'no', 'false', '0', 'inactif'], true);
    }

    private function exact(array $headers, array $candidates): ?int
    {
        foreach ($candidates as $candidate) {
            $position = array_search($candidate, $headers, true);
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
        return trim(preg_replace('/\s+/u', ' ', (string) $value));
    }

    private function emptyRow(array $row): bool
    {
        foreach ($row as $value) if ($this->value($value) !== '') return false;
        return true;
    }
}
