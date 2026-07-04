<?php

/*
 * This file is part of linkrobins/shoutbox.
 *
 * For detailed copyright and license information, please view the
 * LICENSE file that was distributed with this source code.
 */

namespace LinkRobins\Shoutbox\Tests\unit;

use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use LinkRobins\Shoutbox\Api\ShoutResource;
use Mockery as m;
use Mockery\Adapter\Phpunit\MockeryTestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * The operator-tunable flood-control and retention settings must fall back to
 * the shipped defaults when unset or nonsensical: a negative cooldown or a
 * non-positive row cap coming out of the settings table must never disable
 * flood control or turn pruning into delete-everything.
 */
class ShoutResourceSettingsTest extends MockeryTestCase
{
    private function resource(mixed $cooldown, mixed $maxRows): ExposedShoutResource
    {
        $settings = m::mock(SettingsRepositoryInterface::class);
        $settings->shouldReceive('get')
            ->with('linkrobins-shoutbox.cooldown', ShoutResource::COOLDOWN_SECONDS)
            ->andReturn($cooldown);
        $settings->shouldReceive('get')
            ->with('linkrobins-shoutbox.max_rows', ShoutResource::MAX_ROWS)
            ->andReturn($maxRows);

        return new ExposedShoutResource(m::mock(TranslatorInterface::class), $settings);
    }

    #[Test]
    public function sane_values_pass_through(): void
    {
        $resource = $this->resource(cooldown: '10', maxRows: '100');

        $this->assertEquals(10, $resource->exposedCooldownSeconds());
        $this->assertEquals(100, $resource->exposedMaxRows());
    }

    #[Test]
    public function a_zero_cooldown_is_allowed_but_a_negative_one_falls_back(): void
    {
        $this->assertEquals(0, $this->resource(cooldown: '0', maxRows: '100')->exposedCooldownSeconds());
        $this->assertEquals(
            ShoutResource::COOLDOWN_SECONDS,
            $this->resource(cooldown: '-5', maxRows: '100')->exposedCooldownSeconds()
        );
    }

    #[Test]
    public function a_non_positive_row_cap_falls_back(): void
    {
        $this->assertEquals(ShoutResource::MAX_ROWS, $this->resource(cooldown: '3', maxRows: '0')->exposedMaxRows());
        $this->assertEquals(ShoutResource::MAX_ROWS, $this->resource(cooldown: '3', maxRows: '-1')->exposedMaxRows());
    }
}

class ExposedShoutResource extends ShoutResource
{
    public function exposedCooldownSeconds(): int
    {
        return $this->cooldownSeconds();
    }

    public function exposedMaxRows(): int
    {
        return $this->maxRows();
    }
}
