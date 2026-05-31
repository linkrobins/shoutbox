<?php

namespace LinkRobins\Shoutbox\Api;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Foundation\ValidationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use LinkRobins\Shoutbox\Shout\Shout;
use Tobyz\JsonApiServer\Context;

/**
 * @extends AbstractDatabaseResource<Shout>
 */
class ShoutResource extends AbstractDatabaseResource
{
    /** Minimum seconds between shouts from the same user (flood control). */
    const COOLDOWN_SECONDS = 3;

    /** Hard cap on stored shouts — the shoutbox is ephemeral, older rows are pruned. */
    const MAX_ROWS = 500;

    /** How many shouts the list returns. */
    const LIST_LIMIT = 30;

    public function type(): string
    {
        return 'shouts';
    }

    public function model(): string
    {
        return Shout::class;
    }

    /**
     * Shouts are only visible to viewers of the forum (e.g. not guests on a
     * private forum). There's no per-row visibility, so it's all-or-nothing.
     */
    public function scope(Builder $query, Context $context): void
    {
        if (! $context->getActor()->hasPermission('viewForum')) {
            $query->whereRaw('1 = 0');
        }
    }

    public function newModel(Context $context): object
    {
        if ($context->creating(self::class)) {
            $shout = new Shout();
            $shout->user_id = $context->getActor()->id;
            $shout->created_at = Carbon::now();

            return $shout;
        }

        return parent::newModel($context);
    }

    /**
     * Pre-save: enforce non-empty content and the per-user cooldown.
     */
    public function creating(object $model, Context $context): ?object
    {
        if (trim((string) $model->content) === '') {
            throw new ValidationException(['content' => ['You must enter a message.']]);
        }

        $tooSoon = Shout::where('user_id', $context->getActor()->id)
            ->where('created_at', '>=', Carbon::now()->subSeconds(self::COOLDOWN_SECONDS))
            ->exists();

        if ($tooSoon) {
            throw new ValidationException(['content' => ['You are posting too fast. Please wait a moment.']]);
        }

        return $model;
    }

    /**
     * Post-save: keep the table bounded by pruning all but the newest MAX_ROWS.
     * Two cheap indexed queries, off the display path.
     */
    public function saved(object $model, Context $context): ?object
    {
        $cutoffId = Shout::orderByDesc('id')->skip(self::MAX_ROWS)->value('id');

        if ($cutoffId) {
            Shout::where('id', '<=', $cutoffId)->delete();
        }

        return $model;
    }

    public function sorts(): array
    {
        return [
            SortColumn::make('createdAt'),
        ];
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->defaultSort('-createdAt')
                ->limit(self::LIST_LIMIT)
                ->maxLimit(self::LIST_LIMIT)
                ->defaultInclude(['user']),
            Endpoint\Create::make()
                ->authenticated()
                ->can('linkrobins-shoutbox.shout')
                ->defaultInclude(['user']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete'),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('content')
                ->requiredOnCreate()
                ->writableOnCreate()
                ->maxLength(280)
                ->set(function (Shout $shout, $value) {
                    $shout->content = trim((string) $value);
                }),

            Schema\DateTime::make('createdAt'),

            // Per-actor delete right; routes through ShoutPolicy::delete.
            Schema\Boolean::make('canDelete')
                ->get(fn (Shout $shout, Context $context) => $context->getActor()->can('delete', $shout)),

            Schema\Relationship\ToOne::make('user')
                ->includable(),
        ];
    }
}
