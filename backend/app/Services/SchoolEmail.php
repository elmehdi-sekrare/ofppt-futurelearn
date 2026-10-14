<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

class SchoolEmail
{
    public const DOMAIN = 'ofppt.com';

    /**
     * Build a firstname.lastname@ofppt.com address, adding a numeric suffix
     * (firstname.lastname2@ofppt.com) when the address is already taken.
     */
    public static function generate(string $firstName, string $lastName): string
    {
        $local = trim(self::slug($firstName) . '.' . self::slug($lastName), '.');

        // Fall back to the legacy random code when the name has no usable letters.
        if ($local === '' || $local === '.') {
            do {
                $email = 'f' . random_int(10000, 99999) . '@' . self::DOMAIN;
            } while (User::where('email', $email)->exists());

            return $email;
        }

        $email = $local . '@' . self::DOMAIN;
        $suffix = 1;

        while (User::where('email', $email)->exists()) {
            $suffix++;
            $email = $local . $suffix . '@' . self::DOMAIN;
        }

        return $email;
    }

    /**
     * Same addresses as generate(), checked against an in-memory set of taken
     * addresses (email => true) instead of a query per attempt, for imports
     * that create hundreds of accounts. The new address is added to the set.
     */
    public static function generateAvoiding(string $firstName, string $lastName, array &$taken): string
    {
        $local = trim(self::slug($firstName) . '.' . self::slug($lastName), '.');

        if ($local === '') {
            do {
                $email = 'f' . random_int(10000, 99999) . '@' . self::DOMAIN;
            } while (isset($taken[$email]));
        } else {
            $email = $local . '@' . self::DOMAIN;
            for ($suffix = 2; isset($taken[$email]); $suffix++) $email = $local . $suffix . '@' . self::DOMAIN;
        }

        $taken[$email] = true;
        return $email;
    }

    /** Lowercase, accent-free, letters and digits only (Zineb El-Amrani -> zinebelamrani). */
    private static function slug(string $value): string
    {
        return preg_replace('/[^a-z0-9]/', '', Str::lower(Str::ascii(trim($value)))) ?? '';
    }
}
