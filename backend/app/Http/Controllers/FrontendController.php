<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

class FrontendController extends Controller
{
    /** Serve the React single-page app for routes under /app. */
    public function __invoke(): Response
    {
        $index = public_path('app/index.html');
        abort_unless(is_file($index), 404, 'The frontend build has not been deployed.');

        return response()->file($index);
    }
}
