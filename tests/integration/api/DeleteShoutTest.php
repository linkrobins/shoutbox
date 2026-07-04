<?php

/*
 * This file is part of linkrobins/shoutbox.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Shoutbox\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

class DeleteShoutTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    public function setUp(): void
    {
        parent::setUp();

        $this->extension('linkrobins-shoutbox');

        $this->prepareDatabase([
            'users' => [
                $this->normalUser(), // id 2
            ],
            'shoutbox_shouts' => [
                ['id' => 1, 'user_id' => 1, 'content' => 'admin shout', 'created_at' => Carbon::now()->subMinutes(10)],
                ['id' => 2, 'user_id' => 2, 'content' => 'member shout', 'created_at' => Carbon::now()->subMinutes(5)],
            ],
        ]);
    }

    #[Test]
    public function users_can_delete_their_own_shout(): void
    {
        $response = $this->send(
            $this->request('DELETE', '/api/shouts/2', [
                'authenticatedAs' => 2,
            ])
        );

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertEquals(0, $this->database()->table('shoutbox_shouts')->where('id', 2)->count());
    }

    #[Test]
    public function plain_users_cannot_delete_someone_elses_shout(): void
    {
        $response = $this->send(
            $this->request('DELETE', '/api/shouts/1', [
                'authenticatedAs' => 2,
            ])
        );

        $this->assertEquals(403, $response->getStatusCode());
        $this->assertEquals(1, $this->database()->table('shoutbox_shouts')->where('id', 1)->count());
    }

    #[Test]
    public function moderators_can_delete_any_shout(): void
    {
        // Promote the normal user to the moderator group, which the install
        // migration granted linkrobins-shoutbox.moderate.
        $this->database()->table('group_user')->insert([
            'user_id' => 2, 'group_id' => Group::MODERATOR_ID,
        ]);

        $response = $this->send(
            $this->request('DELETE', '/api/shouts/1', [
                'authenticatedAs' => 2,
            ])
        );

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertEquals(0, $this->database()->table('shoutbox_shouts')->where('id', 1)->count());
    }
}
