<?php

/*
 * This file is part of linkrobins/shoutbox.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Shoutbox\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

class CreateShoutTest extends TestCase
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
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function shoutBody(string $content): array
    {
        return [
            'data' => [
                'type' => 'shouts',
                'attributes' => ['content' => $content],
            ],
        ];
    }

    #[Test]
    public function guests_cannot_shout(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/shouts', [
                'json' => $this->shoutBody('hello'),
            ])
        );

        // An unauthenticated write is rejected before it can reach the auth
        // gate (Flarum's CSRF guard returns 400 for a tokenless session POST);
        // either way the guarantee that matters is that nothing is persisted.
        $this->assertGreaterThanOrEqual(400, $response->getStatusCode());
        $this->assertEquals(0, $this->database()->table('shoutbox_shouts')->count());
    }

    #[Test]
    public function members_can_shout(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/shouts', [
                'authenticatedAs' => 2,
                'json' => $this->shoutBody('hello there'),
            ])
        );

        $this->assertEquals(201, $response->getStatusCode());

        $shout = $this->database()->table('shoutbox_shouts')->first();
        $this->assertNotNull($shout);
        // Authorship comes from the session, never from the request body.
        $this->assertEquals(2, $shout->user_id);
        $this->assertEquals('hello there', $shout->content);
    }

    #[Test]
    public function blank_content_is_rejected(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/shouts', [
                'authenticatedAs' => 2,
                'json' => $this->shoutBody('   '),
            ])
        );

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertEquals(0, $this->database()->table('shoutbox_shouts')->count());
    }

    #[Test]
    public function the_cooldown_blocks_rapid_shouts(): void
    {
        $this->database()->table('shoutbox_shouts')->insert([
            'user_id' => 2, 'content' => 'first', 'created_at' => Carbon::now(),
        ]);

        $response = $this->send(
            $this->request('POST', '/api/shouts', [
                'authenticatedAs' => 2,
                'json' => $this->shoutBody('second, too fast'),
            ])
        );

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertEquals(1, $this->database()->table('shoutbox_shouts')->count());
    }

    #[Test]
    public function old_shouts_are_pruned_past_the_row_cap(): void
    {
        // setting() registers the value before the app boots; writing the
        // settings table mid-test is invisible because settings are
        // memory-cached at boot.
        $this->setting('linkrobins-shoutbox.max_rows', '2');

        // Three old shouts by another user; the cap is 2, so posting a fourth
        // must prune down to the two newest rows.
        $this->prepareDatabase([
            'shoutbox_shouts' => [
                ['user_id' => 1, 'content' => 'one', 'created_at' => Carbon::now()->subMinutes(30)],
                ['user_id' => 1, 'content' => 'two', 'created_at' => Carbon::now()->subMinutes(20)],
                ['user_id' => 1, 'content' => 'three', 'created_at' => Carbon::now()->subMinutes(10)],
            ],
        ]);

        $response = $this->send(
            $this->request('POST', '/api/shouts', [
                'authenticatedAs' => 2,
                'json' => $this->shoutBody('four'),
            ])
        );

        $this->assertEquals(201, $response->getStatusCode());

        $remaining = $this->database()->table('shoutbox_shouts')->orderBy('id')->pluck('content')->all();
        $this->assertEquals(['three', 'four'], $remaining);
    }
}
