/**
 * Custom Include File: hudmsg.inc
 * Fixes issues with set_hudmessage and show_hudmessage functions.
 */

#if defined _hudmsg_included
    #endinput
#endif
#define _hudmsg_included

/**
 * Sets up a HUD message with the specified parameters.
 *
 * @param red          Red color component (0-255).
 * @param green        Green color component (0-255).
 * @param blue         Blue color component (0-255).
 * @param x            X position (-1.0 to 1.0, -1.0 = center).
 * @param y            Y position (-1.0 to 1.0).
 * @param effects      Effects (0 = fade in/out, 1 = flicker).
 * @param fxtime       Effect duration (ignored for fade in/out).
 * @param holdtime     Time the message stays on the screen.
 * @param fadeintime   Time to fade in the message.
 * @param fadeouttime  Time to fade out the message.
 * @param channel      Channel to display the message (0-4).
 * @return             None.
 */
stock set_hudmessage(red = 255, green = 255, blue = 255, Float:x = -1.0, Float:y = 0.65, effects = 0, Float:fxtime = 6.0, Float:holdtime = 12.0, Float:fadeintime = 0.1, Float:fadeouttime = 0.2, channel = 4) {
    message_begin(MSG_ONE_UNRELIABLE, get_user_msgid("HudMsg"), _, 0);
    write_byte(red);
    write_byte(green);
    write_byte(blue);
    write_float(x);
    write_float(y);
    write_byte(effects);
    write_float(fxtime);
    write_float(holdtime);
    write_float(fadeintime);
    write_float(fadeouttime);
    write_byte(channel);
    message_end();
}

/**
 * Displays a HUD message to a specific player.
 *
 * @param id           Player index (0 = all players).
 * @param message      The message to display.
 * @return             None.
 */
stock show_hudmessage(id, const message[]) {
    message_begin(id ? MSG_ONE_UNRELIABLE : MSG_BROADCAST, get_user_msgid("HudMsg"), _, id);
    write_string(message);
    message_end();
}