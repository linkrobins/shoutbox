<?php

namespace LinkRobins\Shoutbox\Api\Controller;

use Flarum\Http\RequestUtil;
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

        $actor->assertAdmin();

        $shout->delete();

        return new EmptyResponse(204);
    }
}
