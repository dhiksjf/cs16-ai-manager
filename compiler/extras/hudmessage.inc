#if defined _hudmessage_included
  #endinput
#endif
#define _hudmessage_included

// Function prototypes
public sendHudMessage(const index, const message[], const red, const green, const blue,
                      const Float: x, const Float: y, const effect, const Float: fxTime,
                      const Float: holdTime, const Float: fadeInTime, const Float: fadeOutTime);

public getColorByName(const colorName[], &red, &green, &blue);

#define pack_color(%0,%1,%2) ( %0 + ( %1 << 8 ) + ( %2 << 16 ) )
#define write_float(%0) ( write_byte( ( _:%0 & 0xFF ) ), \
                          write_byte( ( _:%0 >> 8 ) & 0xFF ), \
                          write_byte( ( _:%0 >> 16 ) & 0xFF ), \
                          write_byte( ( _:%0 >> 24 ) & 0xFF ) )

public sendHudMessage(const index, const message[], const red, const green, const blue,
                      const Float: x, const Float: y, const effect, const Float: fxTime,
                      const Float: holdTime, const Float: fadeInTime, const Float: fadeOutTime)
{
    message_begin(MSG_ONE, SVC_DIRECTOR, _, index);
    {
        write_byte(strlen(message) + 31); // size of write_*
        write_byte(DRC_CMD_MESSAGE);
        write_byte(effect);
        write_long(pack_color(red, green, blue));
        write_float(x);
        write_float(y);
        write_float(fadeInTime);
        write_float(fadeOutTime);
        write_float(holdTime);
        write_float(fxTime);
        write_string(message);
    }
    message_end();
}

public getColorByName(const colorName[], &red, &green, &blue)
{
    if (equal(colorName, "red"))
    {
        red = 255; green = 0; blue = 0;
    }
    else if (equal(colorName, "green"))
    {
        red = 0; green = 255; blue = 0;
    }
    else if (equal(colorName, "blue"))
    {
        red = 0; green = 0; blue = 255;
    }
    else if (equal(colorName, "yellow"))
    {
        red = 255; green = 255; blue = 0;
    }
    else if (equal(colorName, "cyan"))
    {
        red = 0; green = 255; blue = 255;
    }
    else if (equal(colorName, "magenta"))
    {
        red = 255; green = 0; blue = 255;
    }
    else if (equal(colorName, "white"))
    {
        red = 255; green = 255; blue = 255;
    }
    else if (equal(colorName, "black"))
    {
        red = 0; green = 0; blue = 0;
    }
    else
    {
        return false; // Invalid color name
    }

    return true;
}
