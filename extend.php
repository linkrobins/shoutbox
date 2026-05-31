<?php

use Flarum\Extend;
use LinkRobins\Shoutbox\Access\ShoutPolicy;
use LinkRobins\Shoutbox\Api\ShoutResource;
use LinkRobins\Shoutbox\Shout\Shout;

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

    // The 'shouts' API resource: standard JSON:API at /api/shouts (Index,
    // Create, Delete). Replaces the hand-built JSON controllers.
    new Extend\ApiResource(ShoutResource::class),

    (new Extend\Policy())
        ->modelPolicy(Shout::class, ShoutPolicy::class),

    (new Extend\Settings())
        ->default('linkrobins-shoutbox.height', '320')
        ->serializeToForum('shoutboxHeight', 'linkrobins-shoutbox.height'),
];
