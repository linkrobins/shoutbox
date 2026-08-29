<?php

/*
 * This file is part of linkrobins/shoutbox.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Shoutbox\Tests\integration\api;

use Flarum\Group\Group;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The view permission (requested on the extension thread): seeded to everyone
 * so updating changes nothing, revocable so a shoutbox can be members-only.
 * The API scope is the enforcement; the forum attribute is what the frontend
 * gates the widget, nav link and page on.
 */
class ViewShoutboxTest extends TestCase
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
                ['id' => 1, 'user_id' => 2, 'content' => 'hello there', 'created_at' => '2026-01-01 00:00:00'],
            ],
        ]);
    }

    private function shoutCount(?int $actor): int
    {
        $options = $actor === null ? [] : ['authenticatedAs' => $actor];

        $response = $this->send($this->request('GET', '/api/shouts', $options));
        $this->assertEquals(200, $response->getStatusCode());

        return count(json_decode($response->getBody()->getContents(), true)['data']);
    }

    private function canViewAttribute(?int $actor): bool
    {
        $options = $actor === null ? [] : ['authenticatedAs' => $actor];

        $response = $this->send($this->request('GET', '/api', $options));

        return (bool) json_decode($response->getBody()->getContents(), true)['data']['attributes']['canViewShoutbox'];
    }

    /**
     * @test
     */
    #[Test]
    public function the_seeded_default_changes_nothing_for_anyone()
    {
        $this->assertSame(1, $this->shoutCount(null), 'guests still see shouts');
        $this->assertSame(1, $this->shoutCount(2), 'members still see shouts');
        $this->assertTrue($this->canViewAttribute(null));
    }

    /**
     * @test
     */
    #[Test]
    public function revoking_the_guest_grant_makes_the_shoutbox_members_only()
    {
        $this->database()->table('group_permission')
            ->where('permission', 'linkrobins-shoutbox.view')
            ->where('group_id', Group::GUEST_ID)
            ->delete();
        $this->database()->table('group_permission')->insert([
            'group_id' => Group::MEMBER_ID,
            'permission' => 'linkrobins-shoutbox.view',
        ]);

        $this->assertSame(0, $this->shoutCount(null), 'guests get an empty list, never an error');
        $this->assertFalse($this->canViewAttribute(null), 'and the frontend is told to hide everything');

        $this->assertSame(1, $this->shoutCount(2), 'members keep the shoutbox');
        $this->assertTrue($this->canViewAttribute(2));
    }

    /**
     * @test
     */
    #[Test]
    public function the_page_404s_for_the_unpermitted()
    {
        $this->database()->table('group_permission')
            ->where('permission', 'linkrobins-shoutbox.view')
            ->delete();

        $guest = $this->send($this->request('GET', '/shoutbox'));
        $this->assertEquals(404, $guest->getStatusCode());

        // Admins bypass permissions and keep the page.
        $admin = $this->send($this->request('GET', '/shoutbox', ['authenticatedAs' => 1]));
        $this->assertEquals(200, $admin->getStatusCode());
    }
}
