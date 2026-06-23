<?php

use Flarum\Extend;
use LinkRobins\Shoutbox\Access\ShoutPolicy;
use LinkRobins\Shoutbox\Api\ShoutResource;
use LinkRobins\Shoutbox\Content\ShoutboxPage;
use LinkRobins\Shoutbox\Shout\Shout;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less')
        // Server-side route so /shoutbox is reachable by direct URL (serves
        // the SPA shell); the matching client route is registered in forum.js.
        // The content handler 404s the page in 'widget'-only display mode.
        ->route('/shoutbox', 'linkrobins-shoutbox', ShoutboxPage::class),

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
        ->serializeToForum('shoutboxHeight', 'linkrobins-shoutbox.height')
        // Where the shoutbox appears: 'both' (page + widget), 'widget' (widget
        // only), or 'page' (page only). The forum frontend gates the route,
        // sidebar nav link and the fof widget on this value.
        ->default('linkrobins-shoutbox.display_mode', 'both')
        ->serializeToForum('shoutboxDisplayMode', 'linkrobins-shoutbox.display_mode')
        // Flood control and retention, operator-tunable from the admin panel.
        // The resource falls back to its own constants if these are unset.
        ->default('linkrobins-shoutbox.cooldown', 3)
        ->default('linkrobins-shoutbox.max_rows', 500),
];
