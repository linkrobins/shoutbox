<?php

use Flarum\Database\Migration;
use Flarum\Group\Group;

// The view permission arrives seeded to guests — in Flarum's permission model
// the guest group means "everyone" — so updating changes nothing until an
// admin deliberately restricts who may see the shoutbox (the request that
// prompted this: members-only shoutboxes). Admins always see everything.
return Migration::addPermissions([
    'linkrobins-shoutbox.view' => Group::GUEST_ID,
]);
