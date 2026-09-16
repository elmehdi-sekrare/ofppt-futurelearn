<?php

use App\Http\Controllers\FrontendController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/app/');
});

// Apache serves real files in public/app (JavaScript, CSS, images) directly.
// Any other /app URL is a React route and must receive index.html.
Route::get('/app/{any?}', FrontendController::class)->where('any', '.*');
