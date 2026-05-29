<?php

use Flarum\Extend;
use LinkRobins\Shoutbox\Api\Controller\CreateShoutController;
use LinkRobins\Shoutbox\Api\Controller\DeleteShoutController;
use LinkRobins\Shoutbox\Api\Controller\ListShoutsController;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less')
        // Server-side route so /shoutbox is reachable by direct URL (serves
        // the SPA shell); the matching client route is registered in forum.js.
        ->route('/shoutbox', 'linkrobins-shoutbox'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\Routes('api'))
        ->get('/shoutbox',         'shoutbox.list',   ListShoutsController::class)
        ->post('/shoutbox',        'shoutbox.create', CreateShoutController::class)
        ->delete('/shoutbox/{id}', 'shoutbox.delete', DeleteShoutController::class),

    (new Extend\Settings())
        ->default('linkrobins-shoutbox.height', '320')
        ->serializeToForum('shoutboxHeight', 'linkrobins-shoutbox.height'),
];
