/*
 * Economy System Include File (economy.inc)
 *
 * This file defines functions and constants related to the economy system.
 */

#if defined _economy_included
 #endinput
#endif
#define _economy_included

// Constants
#define ECONOMY_MAX_MONEY  65535 // Maximum amount of money a player can have
#define ECONOMY_STARTING_MONEY 1000 // Starting money for each player

// Function Declarations

/**
 * @brief Initializes the economy system.
 *        This function is called during plugin initialization.
 */
native Economy_Init();

/**
 * @brief Gets the maximum amount of money a player can have.
 *
 * @return The maximum amount of money.
 */
native Economy_GetMaxMoney();

/**
 * @brief Gets the starting money for a player.
 *
 * @return The starting money.
 */
native Economy_GetStartingMoney();


// Implementation (optional - can be left empty if all functionality is in the .sma)

public Economy_Init()
{
	// Initialize economy-related data here (if needed).
	// Example: Loading money from a file or database upon server start.
	server_print("[ESS] Economy System Initialized.");
}

public Economy_GetMaxMoney()
{
	// Returns the maximum money.
	return ECONOMY_MAX_MONEY;
}

public Economy_GetStartingMoney()
{
	// Returns the starting money.
	return ECONOMY_STARTING_MONEY;
}

/*

// Example of loading from a config file.  This would normally be called by Config_LoadValues (see config.inc).
stock Economy_LoadConfigValues(szConfigFile[])
{
	new temp[16], configValue[16];

	new ini = ini_open(szConfigFile);

	if (ini != INVALID_HANDLE)
	{
		ini_getkey(ini, "Economy", "MaxMoney", configValue, 15);
		ECONOMY_MAX_MONEY = str_to_num(configValue);

		ini_getkey(ini, "Economy", "StartingMoney", configValue, 15);
		ECONOMY_STARTING_MONEY = str_to_num(configValue);

		ini_close(ini);
		server_print("[ESS] Economy config values loaded.");
	}
	else
	{
		server_print("[ESS] Failed to open economy config file.");
	}
}

*/