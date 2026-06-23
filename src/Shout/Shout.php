<?php

namespace LinkRobins\Shoutbox\Shout;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
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

    protected $casts = ['created_at' => 'datetime'];
    protected $fillable = ['user_id', 'content'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
