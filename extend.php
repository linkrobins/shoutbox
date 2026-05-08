<?php

use Flarum\Extend;
use LinkRobins\Shoutbox\Api\Controller\CreateShoutController;
use LinkRobins\Shoutbox\Api\Controller\DeleteShoutController;
use LinkRobins\Shoutbox\Api\Controller\ListShoutsController;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/admin.js'),

    new Extend\Locales(__DIR__ . '/locale'),

    (new Extend\Routes('api'))
        ->get('/shoutbox',         'shoutbox.list',   ListShoutsController::class)
        ->post('/shoutbox',        'shoutbox.create', CreateShoutController::class)
        ->delete('/shoutbox/{id}', 'shoutbox.delete', DeleteShoutController::class),

    (new Extend\Settings())
        ->default('linkrobins-shoutbox.height', '320')
        ->serializeToForum('shoutboxHeight', 'linkrobins-shoutbox.height'),
];
