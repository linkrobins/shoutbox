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
        // Message order: 'oldest_first' (newest at the bottom, chat style) or
        // 'newest_first' (newest at the top, with the input box above the list).
        ->default('linkrobins-shoutbox.order', 'oldest_first')
        ->serializeToForum('shoutboxOrder', 'linkrobins-shoutbox.order')
        // Where the typing box sits: 'auto' follows the message order (bottom
        // for oldest-first, top for newest-first), or pin it to 'top'/'bottom'.
        ->default('linkrobins-shoutbox.composer_position', 'auto')
        ->serializeToForum('shoutboxComposerPosition', 'linkrobins-shoutbox.composer_position')
        // How often an open shoutbox asks the server for new messages. Higher
        // values mean less load on busy forums; the frontend clamps the range.
        ->default('linkrobins-shoutbox.poll_interval', 30)
        ->serializeToForum('shoutboxPollInterval', 'linkrobins-shoutbox.poll_interval')
        // Flood control and retention, operator-tunable from the admin panel.
        // The resource falls back to its own constants if these are unset.
        ->default('linkrobins-shoutbox.cooldown', 3)
        ->default('linkrobins-shoutbox.max_rows', 500),
];
