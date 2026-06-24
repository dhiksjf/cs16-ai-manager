/*
* XP System Utility Functions
* Author: Your Name
* Date: 2024-01-28
* Description: This file defines utility functions for the XP/Level system plugin.
*
* Instructions:
* 1. Include this file in your plugin using: #include "xp_utils.inc"
*
* Debugging:
* - Add log_amx() statements to track function calls and variable values.
*/

#if defined _xp_utils_included
	#endinput
#endif
#define _xp_utils_included

#include <amxmodx> // Include AMX Mod X

// Give player health.  This is an example of how to use a custom function.
//Function to give a player health, up to a maximum of 100.
stock GivePlayerArmor(id, amount)
{
	new currentArmor = get_user_armor(id);
	new newArmor = currentArmor + amount;

	if (newArmor > 100)
	{
		newArmor = 100;
	}

	set_user_armor(id, newArmor);
}

//Sets the health of the entity.
stock SetEntityHealth(entity, Float:health)
{
	//Validate the entity is valid.
	 if(!is_valid_ent(entity))
		return;

	//Set the entity's health.
	SetEntPropFloat(entity, Prop_Data, "m_fHealth", health);
}

//Gets the user's current health.  This function is used as an example for xp_api.inc
stock GetUserHealth(id)
{
	return get_user_health(id);
}

// Sets the user's health. This function is used as an example for xp_api.inc
stock SetUserHealth(id, health)
{
	set_user_health(id, health);
	return PLUGIN_CONTINUE;
}