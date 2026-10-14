<?php

namespace App\Services;

use App\Models\Group;
use App\Models\Teacher;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;

/**
 * Reads an OFPPT assignment workbook ("Affectation 20xx-20xx") and turns its
 * one-row-per-module plan into one entry per trainer, with the modules
 * (matières) they teach and the groups they teach them to.
 *
 * The workbook usually opens on pivot-table sheets, so the data sheet is
 * located by its headers rather than its position.
 */
class AssignmentWorkbookReader
{
    private const MAX_ROWS = 5000;
    private const HEADER_SCAN_ROWS = 10;

    /** Values the planning office uses in the trainer column for "nobody yet". */
    private const PLACEHOLDER_TRAINERS = [
        'non affecte', 'non affectee', 'a affecter', 'vacant', 'aucun', 'na', 'n a', 'tbd', 'x', '-',
    ];

    /** Level codes used in the "Niveau" column, mapped to the diploma names the Groups page uses. */
    public const DEGREES = [
        'TS' => 'Technicien Spécialisé',
        'T' => 'Technicien',
        'Q' => 'Qualification',
        'FQ' => 'Qualification',
        'S' => 'Spécialisation',
    ];

    /**
     * Very common given names. When one appears second and the first word is
     * not one, the cell is almost certainly written NOM PRÉNOM and we swap it.
     * Anything we change is flagged so the admin can check it in the preview.
     */
    private const COMMON_GIVEN_NAMES = [
        'mohamed', 'mohammed', 'mohammad', 'mohamad', 'ahmed', 'ahmad', 'youssef', 'yousef', 'hassan', 'hicham',
        'meryem', 'mariem', 'maryam', 'fatima', 'fatiha', 'khadija', 'aicha', 'zineb', 'zaynab', 'salma', 'sara', 'sanae',
        'abdessamad', 'abdellah', 'abdelkader', 'abderrahmane', 'said', 'rachid', 'karim', 'nadia', 'naima', 'latifa',
    ];

    public function read(UploadedFile $file): array
    {
        $table = $this->locateTable($file);
        $columns = $table['columns'];

        $trainers = [];
        $groups = [];
        $skipped = ['unassigned' => 0, 'missing_group' => 0, 'missing_module' => 0];
        $dataRows = 0;

        foreach ($table['rows'] as [$sourceRow, $row]) {
            if ($this->emptyRow($row)) continue;
            if (++$dataRows > self::MAX_ROWS) {
                throw new RuntimeException('A single import is limited to ' . self::MAX_ROWS . ' rows.');
            }

            $trainerName = $this->value($row[$columns['trainer']] ?? '');
            $groupName = $this->value($row[$columns['group']] ?? '');
            $moduleName = $this->value($row[$columns['module']] ?? '');

            if ($this->isPlaceholderTrainer($trainerName)) { $skipped['unassigned']++; continue; }
            if ($groupName === '') { $skipped['missing_group']++; continue; }
            if ($moduleName === '') { $skipped['missing_module']++; continue; }

            $groupKey = mb_strtoupper($groupName);
            if (!isset($groups[$groupKey])) {
                $levelCode = strtoupper($this->value($row[$columns['level']] ?? ''));
                $groups[$groupKey] = [
                    'name' => $groupName,
                    'degree' => self::DEGREES[$levelCode] ?? ($levelCode !== '' ? $levelCode : null),
                    'study_year' => $this->studyYear($row[$columns['year']] ?? null),
                    'filiere' => $this->value($row[$columns['filiere']] ?? '') ?: null,
                    'trainers' => [],
                ];
            }

            $trainerKey = $this->nameKey($trainerName);
            if (!isset($trainers[$trainerKey])) {
                [$first, $last, $needsCheck] = $this->splitName($trainerName);
                $trainers[$trainerKey] = [
                    'source_name' => $trainerName,
                    'first_name' => $first,
                    'last_name' => $last,
                    'name_check' => $needsCheck,
                    'modules' => [],
                    'groups' => [],
                    'rows' => 0,
                ];
            }

            $trainers[$trainerKey]['rows']++;
            $trainers[$trainerKey]['groups'][$groupKey] = $groupName;
            $moduleKey = mb_strtolower($moduleName);
            if (!isset($trainers[$trainerKey]['modules'][$moduleKey])) {
                $trainers[$trainerKey]['modules'][$moduleKey] = [
                    'name' => Str::limit($moduleName, 188, '...'),
                    'code' => $this->value($row[$columns['module_code']] ?? '') ?: null,
                ];
            }
            $groups[$groupKey]['trainers'][$trainerKey] = true;
        }

        if ($trainers === []) {
            throw new RuntimeException('No trainer assignments were found. Check that the sheet has Groupe, Module and Formateur columns.');
        }

        return [
            'sheet' => $table['sheet'],
            'academic_year' => $table['academic_year'] ?: $this->currentAcademicYear(),
            'rows' => $dataRows,
            'skipped' => $skipped,
            'trainers' => $this->resolveTrainers($trainers),
            'groups' => $this->resolveGroups($groups),
        ];
    }

    // ── Locating the data ─────────────────────────────────────────────

    /** @return array{sheet: string, columns: array<string,int|null>, academic_year: string, rows: array<int, array{0:int,1:array}>} */
    private function locateTable(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $fallbackYear = $this->academicYearFrom($file->getClientOriginalName());

        if (in_array($extension, ['csv', 'txt'], true)) {
            $rows = $this->readCsv($file->getRealPath());
            $table = $this->findTable('CSV', $rows, $fallbackYear);
            if ($table) return $table;
        } elseif ($extension === 'xlsx') {
            $reader = new XlsxReader();
            try {
                $reader->open($file->getRealPath());
            } catch (\Throwable) {
                throw new RuntimeException('The Excel file could not be opened.');
            }

            try {
                foreach ($reader->getSheetIterator() as $sheet) {
                    $table = $this->findTable($sheet->getName(), $sheet->getRowIterator(), $fallbackYear);
                    if ($table) return $table;
                }
            } finally {
                $reader->close();
            }
        } else {
            throw new RuntimeException('Only XLSX and CSV files are supported for trainer imports.');
        }

        throw new RuntimeException('No sheet with Groupe, Module and Formateur columns was found in this file.');
    }

    /**
     * Looks for a header row in the first few rows. Rows are trimmed to the
     * header's width: the official workbook declares 16,370 mostly empty
     * columns, which we never want to hold in memory.
     */
    private function findTable(string $sheet, iterable $rows, string $fallbackYear): ?array
    {
        $columns = null;
        $width = 0;
        $academicYear = $fallbackYear;
        $data = [];
        $position = 0;

        foreach ($rows as $row) {
            $position++;
            $cells = is_array($row) ? $row : $row->toArray();

            if ($columns === null) {
                if ($position > self::HEADER_SCAN_ROWS) return null;
                $headers = array_map(fn ($value) => $this->header($value), $cells);
                $found = $this->matchColumns($headers);
                if ($found === null) continue;

                $columns = $found;
                $width = max(array_filter($found, fn ($index) => $index !== null)) + 1;
                $academicYear = $this->academicYearFrom((string) ($cells[$found['trainer']] ?? '')) ?: $fallbackYear;
                continue;
            }

            $data[] = [$position, array_slice($cells, 0, $width)];
        }

        return $columns === null ? null : [
            'sheet' => $sheet,
            'columns' => $columns,
            'academic_year' => $academicYear,
            'rows' => $data,
        ];
    }

    /** @return array<string, int|null>|null */
    private function matchColumns(array $headers): ?array
    {
        $group = $this->exact($headers, ['groupe', 'group', 'code groupe', 'nom groupe']);
        $module = $this->exact($headers, ['module', 'matiere', 'nom module', 'intitule module', 'libelle module']);
        // "Formateur Affecté Présentiel Actif 2026-2027" in the official file;
        // a plain "Formateur" header in hand-made ones. "Mle Formateur" is the
        // matricule column and must not match.
        $trainer = $this->exact($headers, ['formateur', 'trainer', 'enseignant', 'nom formateur', 'formateur affecte'])
            ?? $this->prefixed($headers, ['formateur affecte', 'formateur']);

        if ($group === null || $module === null || $trainer === null) return null;

        return [
            'group' => $group,
            'module' => $module,
            'trainer' => $trainer,
            'module_code' => $this->exact($headers, ['code module']),
            'level' => $this->exact($headers, ['niveau', 'level']),
            'year' => $this->exact($headers, ['annee de formation', 'annee', 'annee formation']),
            'filiere' => $this->exact($headers, ['filiere', 'filiere formation']),
        ];
    }

    // ── Matching against the database ─────────────────────────────────

    private function resolveTrainers(array $trainers): array
    {
        $existing = Teacher::with('user')->get()
            ->filter(fn (Teacher $teacher) => $teacher->user)
            ->keyBy(fn (Teacher $teacher) => $this->nameKey($teacher->user->first_name . ' ' . $teacher->user->last_name));

        $result = [];
        $index = 0;
        foreach ($trainers as $key => $trainer) {
            $match = $existing->get($key);
            $groups = array_values($trainer['groups']);
            sort($groups, SORT_NATURAL);

            $result[] = [
                'index' => $index++,
                'source_name' => $trainer['source_name'],
                'first_name' => $match ? $match->user->first_name : $trainer['first_name'],
                'last_name' => $match ? $match->user->last_name : $trainer['last_name'],
                'name_check' => $match ? false : $trainer['name_check'],
                'status' => $match ? 'existing' : 'new',
                'existing_teacher_id' => $match?->id,
                'existing_email' => $match?->user->email,
                'modules' => array_values($trainer['modules']),
                'groups' => $groups,
                'rows' => $trainer['rows'],
            ];
        }

        usort($result, fn ($a, $b) => strnatcasecmp($a['source_name'], $b['source_name']));
        foreach ($result as $position => &$entry) $entry['index'] = $position;

        return $result;
    }

    private function resolveGroups(array $groups): array
    {
        $existing = Group::query()->get()->keyBy(fn (Group $group) => mb_strtoupper(trim($group->name)));

        $result = [];
        foreach ($groups as $key => $group) {
            $match = $existing->get($key);
            $result[] = [
                'name' => $group['name'],
                'degree' => $group['degree'],
                'study_year' => $group['study_year'],
                'filiere' => $group['filiere'],
                'trainer_count' => count($group['trainers']),
                'status' => !$match ? 'new' : (($match->status ?? 'active') === 'archived' ? 'archived' : 'existing'),
                'existing_group_id' => $match?->id,
            ];
        }

        usort($result, fn ($a, $b) => strnatcasecmp($a['name'], $b['name']));
        return $result;
    }

    // ── Names ─────────────────────────────────────────────────────────

    /**
     * Splits "PRÉNOM NOM" and fixes the common irregular cases. Returns
     * [first, last, needsCheck]; needsCheck is raised whenever we guessed.
     */
    private function splitName(string $raw): array
    {
        $tokens = preg_split('/\s+/', trim($raw)) ?: [];
        if (count($tokens) === 1) return [$this->displayCase($tokens[0]), '', true];

        $lower = array_map(fn ($token) => mb_strtolower(Str::ascii($token)), $tokens);
        $firstCount = 1;
        $needsCheck = count($tokens) > 2;
        $particles = ['el', 'al', 'ait', 'ben', 'bou', 'ibn', 'ould'];

        // "ABDERRAHIM EL GHARABI": a particle second means PRÉNOM + compound NOM.
        // That is the normal shape, so it does not need a second look.
        if (count($tokens) === 3 && in_array($lower[1], $particles, true) && !in_array($lower[0], $particles, true)) {
            $needsCheck = false;
        }

        // Two-word given names: "EL HOUSSIN HIDANE", "NOUR EDDINE MAKROUM".
        if (count($tokens) >= 3 && (in_array($lower[0], ['el', 'al'], true)
            || ($lower[0] === 'nour' && in_array($lower[1], ['eddine', 'eddin', 'dine', 'el'], true)))) {
            $firstCount = 2;
        }

        $first = array_slice($tokens, 0, $firstCount);
        $last = array_slice($tokens, $firstCount);

        // "AIT FIR ABDESSAMAD": a family-name particle first means NOM + PRÉNOM.
        if (count($tokens) >= 3 && in_array($lower[0], ['ait', 'ben', 'ibn', 'ould', 'bou'], true)) {
            $first = [end($tokens)];
            $last = array_slice($tokens, 0, -1);
            $needsCheck = true;
        }

        // "FAHIM MOHAMED", "ELAMMARY MERYEM": written NOM PRÉNOM.
        if (count($tokens) === 2
            && in_array($lower[1], self::COMMON_GIVEN_NAMES, true)
            && !in_array($lower[0], self::COMMON_GIVEN_NAMES, true)) {
            [$first, $last] = [[$tokens[1]], [$tokens[0]]];
            $needsCheck = true;
        }

        return [$this->displayCase(implode(' ', $first)), $this->displayCase(implode(' ', $last)), $needsCheck];
    }

    /** "ER-RASSAMY" -> "Er-Rassamy"; spreadsheets are typed in capitals. */
    private function displayCase(string $value): string
    {
        $lower = mb_strtolower($value);
        return preg_replace_callback('/(^|[\s\-\'’])(\p{L})/u', fn ($m) => $m[1] . mb_strtoupper($m[2]), $lower);
    }

    /** Order-insensitive identity for a person: "Fahim Mohamed" == "MOHAMED FAHIM". */
    private function nameKey(string $name): string
    {
        $tokens = preg_split('/[^a-z0-9]+/', mb_strtolower(Str::ascii($name)), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        sort($tokens);
        return implode(' ', $tokens);
    }

    private function isPlaceholderTrainer(string $name): bool
    {
        if ($name === '') return true;
        // The official workbook ends with a totals row whose trainer cell is "1".
        if (preg_match('/^\d+([.,]\d+)?$/', $name)) return true;
        $normalized = trim(preg_replace('/[^a-z0-9]+/', ' ', mb_strtolower(Str::ascii($name))));
        return $normalized === '' || in_array($normalized, self::PLACEHOLDER_TRAINERS, true);
    }

    // ── Small parsing helpers ─────────────────────────────────────────

    private function studyYear(mixed $value): ?string
    {
        $year = (int) $this->value($value);
        return match ($year) {
            1 => '1ère année',
            2 => '2ème année',
            3 => '3ème année',
            default => null,
        };
    }

    private function academicYearFrom(string $text): string
    {
        if (preg_match('/(20\d{2})\s*[-\/]\s*(20\d{2})/', $text, $m) && (int) $m[2] === (int) $m[1] + 1) {
            return "{$m[1]}-{$m[2]}";
        }
        return '';
    }

    /** September starts a new academic year. */
    private function currentAcademicYear(): string
    {
        $year = (int) now()->format('Y');
        $start = (int) now()->format('n') >= 9 ? $year : $year - 1;
        return $start . '-' . ($start + 1);
    }

    private function exact(array $headers, array $candidates): ?int
    {
        foreach ($candidates as $candidate) {
            $position = array_search($candidate, $headers, true);
            if ($position !== false) return $position;
        }
        return null;
    }

    private function prefixed(array $headers, array $prefixes): ?int
    {
        foreach ($prefixes as $prefix) {
            foreach ($headers as $position => $header) {
                if ($header !== '' && str_starts_with($header, $prefix)) return $position;
            }
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
        foreach ($row as $value) {
            if ($this->value($value) !== '') return false;
        }
        return true;
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
}
