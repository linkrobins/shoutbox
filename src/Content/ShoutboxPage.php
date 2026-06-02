<?php

namespace LinkRobins\Shoutbox\Content;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Content handler for the standalone /shoutbox page. The page is only served
 * when the admin display mode includes it ('both' or 'page'); in 'widget'-only
 * mode a direct visit 404s — matching the forum frontend, which doesn't
 * register the client-side route in that mode either. Without this, a direct
 * hit on /shoutbox would serve the SPA shell (HTTP 200) and only redirect home
 * client-side.
 */
class ShoutboxPage
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function __invoke(Document $document, Request $request): Document
    {
        $mode = $this->settings->get('linkrobins-shoutbox.display_mode', 'both');

        if ($mode === 'widget') {
            throw new RouteNotFoundException();
        }

        return $document;
    }
}
