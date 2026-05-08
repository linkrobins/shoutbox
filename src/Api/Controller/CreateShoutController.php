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
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body    = $request->getParsedBody();
        $content = trim((string) ($body['content'] ?? ''));

        if (!$content || mb_strlen($content) > 280) {
            return new JsonResponse(['errors' => [['detail' => 'Invalid content.']]], 422);
        }

        $shout = new Shout();
        $shout->user_id    = $actor->id;
        $shout->content    = $content;
        $shout->created_at = Carbon::now();
        $shout->save();

        $shout->load('user');
        $user = $shout->user;

        return new JsonResponse([
            'data' => [
                'id'   => (string) $shout->id,
                'type' => 'shouts',
                'attributes' => [
                    'content'   => $shout->content,
                    'createdAt' => Carbon::parse($shout->created_at)->toIso8601String(),
                    'canDelete' => $actor->isAdmin(),
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
