/*
 * shop_utils.inc
 * Author: AMX Mod X Master Developer
 * Date: [Current Date]
 * Description: Provides utility functions for the shop system.
 *
 * Instructions:
 * 1. Place this file in the 'include' folder of your AMX Mod X installation.
 * 2. Include this file in your plugin using: #include "shop_utils.inc"
 *
 * Notes:
 * - This file provides utility functions for common tasks.
 */

#if defined _shop_utils_included
 #endinput
#endif
#define _shop_utils_included

#include <amxmodx>
#include <amxmisc>
#include <cstrike>
#include "shop_constants.inc"

// Function to display a message to the player
// id: The player's ID.
// message: The message to display.
stock display_message(id, const message[], any:...) //Fixed missing const
{
	new buffer[512];

	vformat(buffer, charsmax(buffer), message, 3);

	client_print(id, PRINT_CHAT, buffer);
}

// Function to check if a player has admin privileges
// id: The player's ID.
// Returns: True if the player has admin privileges, false otherwise.
stock bool:is_admin(id)
{
	return (get_user_flags(id) & ADMIN_ACCESS) ? true : false; //Simplified the return statement
}

// Function to strip quotes from a string.
// szString: The string to strip.
// Returns: void.
stock strip_quotes(szString[])
{
	new iLen = strlen(szString)

	if (iLen > 1)
	{
		//Remove leading quote
		if (szString[0] == '"')
		{
			for (new i = 0; i < iLen; i++) //Shift string to the left
			{
				 szString[i] = szString[i+1];
			}
			szString[iLen-1] = 0; // Null terminate the string
			 iLen--;
			
		}

		//Remove trailing quote
		//new iNewLen = strlen(szString) //No need to recalculate. already adjusted.
		if (szString[iLen-1] == '"')
		{
			szString[iLen-1] = 0; // Null terminate the string
		}
	}
}

// Function to log a message to the AMX Mod X log file.
// message: The message to log.
stock log_amx(const message[], any:...)
{
	new buffer[512];

	vformat(buffer, charsmax(buffer), message, 3);

	log_amx(buffer);
}

// Function to format a menu item name, ensuring it doesn't exceed the maximum length.
// itemName: The original item name.
// formattedName: The buffer to store the formatted name.
// maxLen: The maximum length of the formatted name.
stock format_menu_item_name(const itemName[], formattedName[], maxLen)
{
	new len = strlen(itemName);

	if (len >= maxLen)
	{
		copy(formattedName, maxLen - 1, itemName); // Copy up to maxLen - 1 to leave space for null terminator
		formattedName[maxLen - 1] = 0; // Ensure null termination
	}
	else
	{
		copy(formattedName, maxLen, itemName);
	}
}

// Function to get the player's IP address
// id: The player's ID.
// ip: The buffer to store the IP address.
// maxLen: The maximum length of the IP address buffer.
stock get_player_ip(id, ip[], maxLen)
{
	new szAuthId[32];
	get_user_authid(id, szAuthId, charsmax(szAuthId));

	if (equal(szAuthId, "STEAM_ID_PENDING"))
	{
		get_user_info(id, "ip", ip, maxLen);
	}
	else
	{
		copy(ip, maxLen, szAuthId);
	}
}