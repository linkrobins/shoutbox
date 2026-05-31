<?php

namespace LinkRobins\Shoutbox\Shout;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int    $id
 * @property int    $user_id
 * @property string $content
 * @property \Carbon\Carbon $created_at
 */
class Shout extends AbstractModel
{
    protected $table = 'shoutbox_shouts';
    public $timestamps = false;

    protected $dates = ['created_at'];
    protected $fillable = ['user_id', 'content'];

    /** Cached list tiers (guest = 10, member = 30). Keep in sync with the list controller. */
    public const LIST_LIMITS = [10, 30];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Cache key for the latest-N list of a given size. Single source of truth. */
    public static function listCacheKey(int $limit): string
    {
        return 'linkrobins-shoutbox.list.' . $limit;
    }

    /** Drop every cached list tier — call after any insert or delete. */
    public static function bustListCache(CacheRepository $cache): void
    {
        foreach (self::LIST_LIMITS as $limit) {
            $cache->forget(self::listCacheKey($limit));
        }
    }
}
