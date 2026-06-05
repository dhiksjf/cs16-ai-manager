/*
 * Configuration Include File (config.inc)
 *
 * This file defines functions to load configuration values from a file.
 */

#if defined _config_included
 #endinput
#endif
#define _config_included

// Function Declarations

/**
 * @brief Loads configuration values from the specified file.
 *
 * @param szConfigFile The path to the configuration file.
 */
native Config_LoadValues(szConfigFile[]);

// Implementation

stock Config_LoadValues(szConfigFile[])
{
	// Example implementation for loading config values.
	// This is just an example and should be adjusted based on your actual config structure.

	new ini = ini_open(szConfigFile);

	if (ini != INVALID_HANDLE)
	{
		// --- Economy --- 
		new configValue[32];

		ini_getkey(ini, "Economy", "MaxMoney", configValue, charsmax(configValue));
		new maxMoney = str_to_num(configValue);
		//Use a setter function in economy.inc instead of accessing the variable directly.
		//ECONOMY_MAX_MONEY = maxMoney;


		ini_getkey(ini, "Economy", "StartingMoney", configValue, charsmax(configValue));
		new startingMoney = str_to_num(configValue);
		//ECONOMY_STARTING_MONEY = startingMoney;

		// --- Skills --- 
		ini_getkey(ini, "Skills", "MaxLevel", configValue, charsmax(configValue));
		new maxLevel = str_to_num(configValue);
		//SKILLS_MAX_LEVEL = maxLevel;

		ini_getkey(ini, "Skills", "BaseXP", configValue, charsmax(configValue));
		new baseXp = str_to_num(configValue);
		//SKILLS_BASE_XP = baseXp;

		// --- Shop --- 
		//Example: Loading shop items (This is very basic, consider loading via a separate function).
		// ini_getkey(ini, "ShopItem1", "Name", configValue, charsmax(configValue));
		// new item_name[64];
		// copy(item_name, charsmax(item_name), configValue);

		ini_close(ini);

		//Re-initialize subsystems with the new config values.
		//Ideally, each subsystem (economy, shop, skills) should have its own
		//LoadConfig function to handle specific config loading.

		//Economy_LoadConfigValues(szConfigFile); //Call economy config loader
		//Skills_LoadConfigValues(szConfigFile); //Call skills config loader
		//Shop_LoadConfigValues(szConfigFile);   //Call shop config loader

		server_print("[ESS] Config values loaded from file.");
	}
	else
	{
		server_print("[ESS] Failed to open config file.");
	}
}

/*

Config File Structure Example (economy_shop_skills.ini):

[Economy]
MaxMoney = 10000
StartingMoney = 1500

[Skills]
MaxLevel = 50
BaseXP = 150

[ShopItem1]
Name = AK-47
Cost = 2700
Category = 0
Command = weapon_ak47

[ShopItem2]
Name = M4A1
Cost = 3100
Category = 0
Command = weapon_m4a1

*/n