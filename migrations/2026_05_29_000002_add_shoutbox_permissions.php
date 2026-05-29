<?php

use Flarum\Database\Migration;
use Flarum\Group\Group;

// Seed sensible defaults so existing forums don't lose functionality on
// upgrade: registered members can shout, moderators can delete any shout.
// Admins always have every permission. Admins can adjust these in the
// Permissions grid afterwards.
return Migration::addPermissions([
    'linkrobins-shoutbox.shout'    => Group::MEMBER_ID,
    'linkrobins-shoutbox.moderate' => Group::MODERATOR_ID,
]);
