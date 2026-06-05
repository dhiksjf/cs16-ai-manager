/*
 * Skills System Include File (skills.inc)
 *
 * This file defines functions and constants related to the skill and experience system.
 */

#if defined _skills_included
 #endinput
#endif
#define _skills_included

// Constants
#define SKILLS_MAX_LEVEL 100 // Maximum level a player can achieve
#define SKILLS_BASE_XP 100  // Base XP required for level 2.  XP required increases exponentially.

// Function Declarations

/**
 * @brief Initializes the skills system.
 *        This function is called during plugin initialization.
 */
native Skills_Init();

/**
 * @brief Gets the XP required for the next level.
 *
 * @param level The current level.
 * @return      The XP required for the next level.
 */
native Skills_GetXPForNextLevel(level);

/**
 * @brief Opens the skills menu for a player.
 *
 * @param playerid The ID of the player to open the skills menu for.
 */
native Skills_OpenMenu(playerid);


// Implementation

public Skills_Init()
{
	// Initialize skills-related data here.
	// Example: Loading skill data from a file or database.
	server_print("[ESS] Skills System Initialized.");
}

public Skills_GetXPForNextLevel(level)
{
	// Calculate XP required for the next level. Exponential scaling.
	//  XP = BaseXP * (Level ^ 2)  (Example formula)
	new Float:xp_float = float(SKILLS_BASE_XP) * float(level * level);
	new xp = floatround(xp_float);

	// Cap the XP at a reasonable value
	if (xp > 32000) //Max value, avoid overflows
	{
		 xp = 32000; // Cap at max value.
	}

	return xp;
}

public Skills_OpenMenu(playerid)
{
	// Create and display the skills menu for the player.
	new menu = menu_create("Skills Menu", "SkillsMenuHandler");

	new szMenuItem[64];
	formatex(szMenuItem, charsmax(szMenuItem), "Level: %d", GetPlayerLevel(playerid));
	menu_additem(menu, szMenuItem, "level");

	formatex(szMenuItem, charsmax(szMenuItem), "XP: %d / %d", GetPlayerXP(playerid), Skills_GetXPForNextLevel(GetPlayerLevel(playerid)));
	menu_additem(menu, szMenuItem, "xp");

	//Add more skill related items here

	menu_setprop(menu, MP_EXIT, "Exit");
	menu_display(playerid, menu, 0);
	return PLUGIN_HANDLED;
}

public SkillsMenuHandler(playerid, menu, item)
{
	// Handle menu item selection.
	menu_destroy(menu);
	return PLUGIN_HANDLED; // For now, just exit. Add skill point allocation logic here.
}

/*
// Example of loading skills data from a config file.
stock Skills_LoadConfigValues(szConfigFile[])
{
	new ini = ini_open(szConfigFile);

	if (ini != INVALID_HANDLE)
	{
		new temp[16], configValue[16];

		ini_getkey(ini, "Skills", "MaxLevel", configValue, 15);
		SKILLS_MAX_LEVEL = str_to_num(configValue);

		ini_getkey(ini, "Skills", "BaseXP", configValue, 15);
		SKILLS_BASE_XP = str_to_num(configValue);

		ini_close(ini);
		server_print("[ESS] Skills config values loaded.");
	}
	else
	{
		server_print("[ESS] Failed to open skills config file.");
	}
}
*/