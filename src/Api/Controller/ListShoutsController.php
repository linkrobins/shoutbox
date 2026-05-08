<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Carbon;
use Laminas\Diactoros\Response\JsonResponse;
use LinkRobins\Shoutbox\Shout\Shout;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class ListShoutsController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        $limit = $actor->isGuest() ? 10 : 30;

        $canViewProfiles = $actor->can('viewForum');

        $shouts = Shout::with('user')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        $data = $shouts->map(function (Shout $shout) use ($actor) {
            return [
                'id'   => (string) $shout->id,
                'type' => 'shouts',
                'attributes' => [
                    'content'   => $shout->content,
                    'createdAt' => $shout->created_at
                        ? Carbon::parse($shout->created_at)->toIso8601String()
                        : null,
                    'canDelete' => $actor->isAdmin(),
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

        $included = $shouts->filter(fn($s) => $s->user)->map(function (Shout $shout) use ($canViewProfiles) {
            $user = $shout->user;
            return [
                'id'   => (string) $user->id,
                'type' => 'users',
                'attributes' => [
                    'displayName' => $user->display_name,
                    'avatarUrl'   => $user->avatar_url,
                    'slug'        => $canViewProfiles ? $user->username : null,
                ],
            ];
        })->unique('id')->values()->all();

        return new JsonResponse(['data' => $data, 'included' => $included]);
    }
}
