<?php

namespace LinkRobins\Shoutbox\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use LinkRobins\Shoutbox\Shout\Shout;

class ShoutPolicy extends AbstractPolicy
{
    /**
     * A user may delete their own shout; holders of the 'moderate' permission
     * (and admins, who bypass policies) may delete anyone's.
     */
    public function delete(User $actor, Shout $shout): ?string
    {
        if ((int) $shout->user_id === (int) $actor->id) {
            return $this->allow();
        }

        if ($actor->hasPermission('linkrobins-shoutbox.moderate')) {
            return $this->allow();
        }

        return $this->deny();
    }
}
