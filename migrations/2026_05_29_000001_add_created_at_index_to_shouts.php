<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// The shout list is ordered by `created_at DESC LIMIT N` and polled every 15s
// by every open client. Without an index this is a filesort over the whole
// table that worsens as shouts accumulate. Index created_at to keep it cheap.
return [
    'up' => function (Builder $schema) {
        $schema->table('shoutbox_shouts', function (Blueprint $table) {
            $table->index('created_at', 'shoutbox_shouts_created_at_index');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('shoutbox_shouts', function (Blueprint $table) {
            $table->dropIndex('shoutbox_shouts_created_at_index');
        });
    },
];
