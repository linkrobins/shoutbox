<?php

namespace LinkRobins\Shoutbox\Api;

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use LinkRobins\Shoutbox\Shout\Shout;
use Tobyz\JsonApiServer\Context;

/**
 * @extends AbstractDatabaseResource<Shout>
 */
class ShoutResource extends AbstractDatabaseResource
{
    public function __construct(
        protected TranslatorInterface $translator,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    /** Default minimum seconds between shouts from the same user (flood control). */
    const COOLDOWN_SECONDS = 3;

    /** Default hard cap on stored shouts — the shoutbox is ephemeral, older rows are pruned. */
    const MAX_ROWS = 500;

    /** How many shouts the list returns. */
    const LIST_LIMIT = 30;

    /** Per-user cooldown in seconds, operator-tunable (defaults to COOLDOWN_SECONDS). */
    protected function cooldownSeconds(): int
    {
        $v = (int) $this->settings->get('linkrobins-shoutbox.cooldown', self::COOLDOWN_SECONDS);
        return $v >= 0 ? $v : self::COOLDOWN_SECONDS;
    }

    /** Retention cap, operator-tunable (defaults to MAX_ROWS); must stay positive. */
    protected function maxRows(): int
    {
        $v = (int) $this->settings->get('linkrobins-shoutbox.max_rows', self::MAX_ROWS);
        return $v > 0 ? $v : self::MAX_ROWS;
    }

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
            throw new ValidationException(['content' => $this->translator->trans('linkrobins-shoutbox.api.empty_content')]);
        }

        $tooSoon = Shout::where('user_id', $context->getActor()->id)
            ->where('created_at', '>=', Carbon::now()->subSeconds($this->cooldownSeconds()))
            ->exists();

        if ($tooSoon) {
            throw new ValidationException(['content' => $this->translator->trans('linkrobins-shoutbox.api.rate_limited')]);
        }

        return $model;
    }

    /**
     * Post-save: settle any cooldown race, then keep the table bounded by
     * pruning all but the newest MAX_ROWS. Cheap indexed queries, off the
     * display path.
     */
    public function saved(object $model, Context $context): ?object
    {
        $this->settleCooldownRace($model);

        $cutoffId = Shout::orderByDesc('id')->skip($this->maxRows())->value('id');

        if ($cutoffId) {
            Shout::where('id', '<=', $cutoffId)->delete();
        }

        return $model;
    }

    /**
     * The pre-save cooldown check reads the table before this row exists, so
     * two requests that arrive in the same instant can both pass it. Re-check
     * now that the row is committed and both racers can see each other: the
     * lower id wins, the loser removes itself and reports the cooldown. This
     * is set-based and lock-free, so it behaves the same on every database
     * Flarum supports.
     *
     * @param Shout $model
     */
    protected function settleCooldownRace(Shout $model): void
    {
        $cooldown = $this->cooldownSeconds();

        if ($cooldown <= 0) {
            return;
        }

        $raced = Shout::where('user_id', $model->user_id)
            ->where('id', '<', $model->id)
            ->where('created_at', '>=', $model->created_at->copy()->subSeconds($cooldown))
            ->exists();

        if ($raced) {
            $model->delete();

            throw new ValidationException(['content' => $this->translator->trans('linkrobins-shoutbox.api.rate_limited')]);
        }
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
