<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use LinkRobins\Shoutbox\Shout\Shout;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class DeleteShoutController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $id    = (int) ($request->getQueryParams()['id'] ?? 0);
        $shout = Shout::find($id);

        if (!$shout) {
            return new JsonResponse(['errors' => [['detail' => 'Shout not found.']]], 404);
        }

        // A user may always delete their own shout; the 'moderate' permission
        // (and admins, who bypass permission checks) may delete anyone's.
        $isOwn = (int) $shout->user_id === (int) $actor->id;
        if (! $isOwn && ! $actor->hasPermission('linkrobins-shoutbox.moderate')) {
            throw new PermissionDeniedException();
        }

        $shout->delete();

        // Drop the cached list so the removal shows on the next poll.
        $cache = resolve('cache.store');
        $cache->forget('linkrobins-shoutbox.list.10');
        $cache->forget('linkrobins-shoutbox.list.30');

        return new EmptyResponse(204);
    }
}
