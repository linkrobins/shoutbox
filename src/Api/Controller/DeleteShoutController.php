<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use LinkRobins\Shoutbox\Shout\Shout;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

class DeleteShoutController implements RequestHandlerInterface
{
    public function __construct(private CacheRepository $cache)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        // `id` is a URL path segment (/shoutbox/{id}); under Flarum's FastRoute
        // stack path params live in the `routeParameters` request attribute, NOT
        // the query string. Reading the query string always yielded 0 -> 404.
        $id    = (int) ($request->getAttribute('routeParameters')['id'] ?? 0);
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
        Shout::bustListCache($this->cache);

        return new EmptyResponse(204);
    }
}
