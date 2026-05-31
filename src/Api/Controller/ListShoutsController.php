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

class ListShoutsController implements RequestHandlerInterface
{
    public function __construct(private CacheRepository $cache)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        // Don't leak shouts (content, display names, avatars) to anyone who
        // can't view the forum -- e.g. guests on a private forum. Everyone
        // reaching this point can view the forum, so usernames are fine.
        $actor->assertCan('viewForum');

        $limit = $actor->isGuest() ? 10 : 30;

        // The latest-N list is identical for every viewer, so cache it briefly
        // to absorb the 15s polling herd. canDelete is per-actor, so it is
        // deliberately NOT cached -- it's applied to each row below.
        $payload = $this->cache->remember(Shout::listCacheKey($limit), 5, function () use ($limit) {
            $shouts = Shout::with('user')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->reverse()
                ->values();

            $data = $shouts->map(function (Shout $shout) {
                return [
                    'id'     => (string) $shout->id,
                    'type'   => 'shouts',
                    'userId' => $shout->user ? (string) $shout->user->id : null,
                    'attributes' => [
                        'content'   => $shout->content,
                        'createdAt' => $shout->created_at
                            ? Carbon::parse($shout->created_at)->toIso8601String()
                            : null,
                    ],
                    'relationships' => [
                        'user' => [
                            'data' => $shout->user ? [
                                'type' => 'users',
                                'id'   => (string) $shout->user->id,
                            ] : null,
                        ],
                    ],
                ];
            })->values()->all();

            $included = $shouts->filter(fn ($s) => $s->user)->map(function (Shout $shout) {
                $user = $shout->user;
                return [
                    'id'   => (string) $user->id,
                    'type' => 'users',
                    'attributes' => [
                        'displayName' => $user->display_name,
                        'avatarUrl'   => $user->avatar_url,
                        'slug'        => $user->username,
                    ],
                ];
            })->unique('id')->values()->all();

            return ['data' => $data, 'included' => $included];
        });

        // Apply per-actor delete rights: holders of the 'moderate' permission
        // (admins bypass) may delete any shout; everyone may delete their own.
        // The `userId` helper is stripped so it never reaches the document.
        $canModerate = $actor->hasPermission('linkrobins-shoutbox.moderate');
        $actorId = (string) $actor->id;
        $data = array_map(function (array $row) use ($canModerate, $actorId) {
            $row['attributes']['canDelete'] = $canModerate
                || ($row['userId'] !== null && $row['userId'] === $actorId);
            unset($row['userId']);
            return $row;
        }, $payload['data']);

        return new JsonResponse(['data' => $data, 'included' => $payload['included']]);
    }
}
