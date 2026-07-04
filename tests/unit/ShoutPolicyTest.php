<?php

/*
 * This file is part of linkrobins/shoutbox.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Shoutbox\Tests\unit;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use LinkRobins\Shoutbox\Access\ShoutPolicy;
use LinkRobins\Shoutbox\Shout\Shout;
use Mockery as m;
use Mockery\Adapter\Phpunit\MockeryTestCase;
use PHPUnit\Framework\Attributes\Test;

class ShoutPolicyTest extends MockeryTestCase
{
    /**
     * Partial mock: real attribute get/set (so ->id works like on a model),
     * only the DB-backed hasPermission is stubbed.
     */
    private function user(int $id, bool $moderate = false): User
    {
        $user = m::mock(User::class)->makePartial();
        $user->id = $id;
        $user->shouldReceive('hasPermission')->andReturnUsing(
            fn (string $permission) => $moderate && $permission === 'linkrobins-shoutbox.moderate'
        );

        return $user;
    }

    private function shout(int $userId): Shout
    {
        $shout = new Shout();
        $shout->user_id = $userId;

        return $shout;
    }

    #[Test]
    public function users_may_delete_their_own_shout(): void
    {
        $result = (new ShoutPolicy())->delete($this->user(id: 2), $this->shout(userId: 2));

        $this->assertEquals(AbstractPolicy::ALLOW, $result);
    }

    #[Test]
    public function moderators_may_delete_any_shout(): void
    {
        $result = (new ShoutPolicy())->delete($this->user(id: 3, moderate: true), $this->shout(userId: 2));

        $this->assertEquals(AbstractPolicy::ALLOW, $result);
    }

    #[Test]
    public function plain_users_may_not_delete_someone_elses_shout(): void
    {
        $result = (new ShoutPolicy())->delete($this->user(id: 3), $this->shout(userId: 2));

        $this->assertEquals(AbstractPolicy::DENY, $result);
    }
}
