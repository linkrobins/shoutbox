<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
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

    /** Hard cap on stored shouts — the shoutbox is ephemeral, so older rows are pruned. */
    const MAX_ROWS = 500;

    public function __construct(private CacheRepository $cache)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        // assertRegistered guarantees a real user (shouts are attributed to one,
        // so a guest must never post even if the guest group held the
        // permission); assertCan routes the permission through Flarum's gate so
        // policies/other extensions can hook the decision.
        $actor->assertRegistered();
        $actor->assertCan('linkrobins-shoutbox.shout');

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

        // Keep the table bounded: the shoutbox is ephemeral, so delete anything
        // older than the newest MAX_ROWS shouts. Two cheap indexed queries off
        // the display path; far above the 30 ever shown.
        $cutoffId = Shout::orderByDesc('id')->skip(self::MAX_ROWS)->value('id');
        if ($cutoffId) {
            Shout::where('id', '<=', $cutoffId)->delete();
        }

        // New shout -> drop the cached list so it appears on the next poll.
        Shout::bustListCache($this->cache);

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
