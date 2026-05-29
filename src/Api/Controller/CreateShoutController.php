<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Carbon;
use Laminas\Diactoros\Response\JsonResponse;
use LinkRobins\Shoutbox\Shout\Shout;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CreateShoutController implements RequestHandlerInterface
{
    /** Minimum seconds between shouts from the same user (flood control). */
    const COOLDOWN_SECONDS = 3;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        // Posting is gated by the 'shout' permission (admins bypass). Keeping
        // assertRegistered too: shouts are attributed to a user, so a guest
        // can never post even if the permission were granted to the guest group.
        $actor->assertPermission($actor->hasPermission('linkrobins-shoutbox.shout'));

        $body    = $request->getParsedBody();
        $content = trim((string) ($body['content'] ?? ''));

        if (!$content || mb_strlen($content) > 280) {
            return new JsonResponse(['errors' => [['detail' => 'Invalid content.']]], 422);
        }

        // Per-user flood control: reject if this user shouted within the
        // cooldown window. Cheap (filtered by the indexed user_id) and stops
        // scripted/accidental spam from bloating the table and the polled feed.
        $tooSoon = Shout::where('user_id', $actor->id)
            ->where('created_at', '>=', Carbon::now()->subSeconds(self::COOLDOWN_SECONDS))
            ->exists();
        if ($tooSoon) {
            return new JsonResponse(
                ['errors' => [['detail' => 'You are posting too fast. Please wait a moment.']]],
                429
            );
        }

        $shout = new Shout();
        $shout->user_id    = $actor->id;
        $shout->content    = $content;
        $shout->created_at = Carbon::now();
        $shout->save();

        // New shout -> drop the cached list so it appears on the next poll.
        $cache = resolve('cache.store');
        $cache->forget('linkrobins-shoutbox.list.10');
        $cache->forget('linkrobins-shoutbox.list.30');

        $shout->load('user');
        $user = $shout->user;

        return new JsonResponse([
            'data' => [
                'id'   => (string) $shout->id,
                'type' => 'shouts',
                'attributes' => [
                    'content'   => $shout->content,
                    'createdAt' => Carbon::parse($shout->created_at)->toIso8601String(),
                    // The creator owns this shout, so they can always delete it.
                    'canDelete' => true,
                ],
                'relationships' => [
                    'user' => [
                        'data' => $user ? ['type' => 'users', 'id' => (string) $user->id] : null,
                    ],
                ],
            ],
            'included' => $user ? [[
                'id'   => (string) $user->id,
                'type' => 'users',
                'attributes' => [
                    'displayName' => $user->display_name,
                    'avatarUrl'   => $user->avatar_url,
                    'slug'        => $user->username,
                ],
            ]] : [],
        ], 201);
    }
}
