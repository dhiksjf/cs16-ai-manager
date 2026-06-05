#if defined _hud_director_included
    #endinput
#endif
#define _hud_director_included

/* HUD DIRECTOR API v6.0 (Production Stable)
   - Fixed bitwise FX handling
   - Added drift-safe Shake
   - Optimized Tweening engine
*/

enum TweenType
{
    TWEEN_LINEAR = 0,
    TWEEN_SINE_OUT,
    TWEEN_BACK_OUT,
    TWEEN_BOUNCE_OUT
};

// Bitwise constants (Can be combined: FX_SPIN | FX_PULSE)
const FX_NONE  = 0;
const FX_SPIN  = (1<<0);
const FX_PULSE = (1<<1);
const FX_SHAKE = (1<<2);

/**
 * Creates or overwrites a sprite in a specific channel.
 *
 * @param id        Player Index.
 * @param channel   Channel ID (0-15).
 * @param model     Path to .spr file.
 * @param x         Screen X (0.0 - 1.0).
 * @param y         Screen Y (0.0 - 1.0).
 * @param scale     Sprite scale.
 * @param alpha     Transparency (0-255).
 * @return          Entity ID of the sprite.
 */
native hud_create(id, channel, const model[], Float:x, Float:y, Float:scale = 0.5, Float:alpha = 255.0);

/**
 * Instantly updates properties (teleport).
 * Pass -1.0 to any float to keep its current value.
 */
native hud_set_props(id, channel, Float:x = -1.0, Float:y = -1.0, Float:scale = -1.0, Float:alpha = -1.0);

/**
 * Animates the sprite to a new state over time.
 *
 * @param id        Player Index.
 * @param channel   Channel ID.
 * @param duration  Time in seconds.
 * @param ease      TweenType curve (see enum).
 * @param x         Target X (-1.0 to ignore).
 * @param y         Target Y (-1.0 to ignore).
 * @param scale     Target Scale (-1.0 to ignore).
 * @param alpha     Target Alpha (-1.0 to ignore).
 */
native hud_animate(id, channel, Float:duration, TweenType:ease, Float:x = -1.0, Float:y = -1.0, Float:scale = -1.0, Float:alpha = -1.0);

/**
 * Applies background effects.
 * @param fx_flags  Bitmask (e.g. FX_SPIN | FX_SHAKE). 0 to stop all.
 * @param speed     Speed of the effect cycle.
 * @param amp       Amplitude (Intensity) of the effect.
 */
native hud_set_effect(id, channel, fx_flags, Float:speed = 1.0, Float:amplitude = 0.1);

/**
 * Instantly destroys the sprite.
 */
native hud_kill(id, channel);

/**
 * Clears all sprites for a player.
 */
native hud_clear_all(id);