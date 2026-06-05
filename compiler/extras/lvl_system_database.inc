/*
 * lvl_system_database.inc
 * Author: AI Assistant
 * Description: Database functions for the level system plugin.
 */

#if defined _lvl_system_database_included
 #endinput
#endif
#define _lvl_system_database_included

#include <amxmodx>
#include <sql>

// Function to initialize the database connection
// Error handling: Checks for SQL module and connection errors.
// Debugging: Prints connection status to the server console.
stock initialize_database()
{
	new szDatabaseHost[64];
	new szDatabaseUser[64];
	new szDatabasePass[64];
	new szDatabaseName[64];

	copy(szDatabaseHost, charsmax(szDatabaseHost), DATABASE_HOST);
	copy(szDatabaseUser, charsmax(szDatabaseUser), DATABASE_USER);
	copy(szDatabasePass, charsmax(szDatabasePass), DATABASE_PASS);
	copy(szDatabaseName, charsmax(szDatabaseName), DATABASE_NAME);

	// Check if the SQL module is loaded
	if (!is_module_loaded("SQL"))
	{
		server_print("[Level System] ERROR: SQL module is not loaded.");
		g_bDatabaseAvailable = false;
		return;
	}

	// Create a new SQL tuple
	g_SQLConnection = SQL_MakeDbTuple(szDatabaseHost, szDatabaseUser, szDatabasePass, szDatabaseName);

	// Check if the connection is valid
	if (g_SQLConnection == INVALID_HANDLE)
	{
		server_print("%s ERROR: Invalid database tuple.", LVLSYS_TAG);
		g_bDatabaseAvailable = false;
		return;
	}

	// Connect to the database
	new iError = SQL_Connect(g_SQLConnection);

	// Check for connection errors
	if (iError)
	{
		new szError[256];
		SQL_GetError(g_SQLConnection, szError, charsmax(szError));
		server_print("%s ERROR: Could not connect to database. %s", LVLSYS_TAG, szError);
		g_bDatabaseAvailable = false;
		return;
	}

	// Database connection successful
	g_bDatabaseAvailable = true;
	server_print("%s Database connection successful.", LVLSYS_TAG);

	//Create table if it doesn't exist.
	create_table();
}

stock create_table()
{
	if (!g_bDatabaseAvailable)
	{
		server_print("[Level System] Database not available, skipping table creation.");
		return;
	}

	new szQuery[SQL_QUERY_MAX_LENGTH];
	formatex(szQuery, charsmax(szQuery), "CREATE TABLE IF NOT EXISTS `%s` (
	`authid` VARCHAR(64) NOT NULL PRIMARY KEY,
	`level` INT NOT NULL DEFAULT '1',
	`xp` INT NOT NULL DEFAULT '0'
	);", DATABASE_TABLE);

	SQL_TQuery(g_SQLConnection, SQL_CreateTable_Callback, szQuery);
}

public SQL_CreateTable_Callback(Handle:hTuple, Result:iResult, const szError[])
{
	// Error handling for table creation
	if (iResult == SQL_ERROR)
	{
		server_print("[Level System] ERROR: Could not create table. %s", szError);
		return;
	}

	server_print("[Level System] Table created or already exists.");
}

// Function to save player data to the database
// Error handling: Checks for database availability and query errors.
// Debugging: Prints save status to the server console.
stock save_player_data(id)
{
	if (!g_bDatabaseAvailable)
	{
		server_print("[Level System] Database not available, skipping save.");
		return;
	}

	new szAuthID[64];
	get_user_authid(id, szAuthID, charsmax(szAuthID));

	new szQuery[SQL_QUERY_MAX_LENGTH];
	formatex(szQuery, charsmax(szQuery), "UPDATE `%s` SET `level` = '%d', `xp` = '%d' WHERE `authid` = '%s'", DATABASE_TABLE, g_iPlayerLevel[id], g_iPlayerXP[id], szAuthID);

	SQL_TQuery(g_SQLConnection, SQL_SaveData_Callback, szQuery, id);
}

public SQL_SaveData_Callback(Handle:hTuple, Result:iResult, const szError[], id)
{
	// Error handling for saving data
	if (iResult == SQL_ERROR)
	{
		server_print("[Level System] ERROR: Could not save data. %s", szError);
		return;
	}

	// Check if any rows were affected (player exists)
	if (SQL_AffectedRows(hTuple) == 0)
	{
		// Player doesn't exist, so insert a new row
		new szAuthID[64];
		get_user_authid(id, szAuthID, charsmax(szAuthID));

		new szInsertQuery[SQL_QUERY_MAX_LENGTH];
		formatex(szInsertQuery, charsmax(szInsertQuery), "INSERT INTO `%s` (`authid`, `level`, `xp`) VALUES ('%s', '%d', '%d')", DATABASE_TABLE, szAuthID, g_iPlayerLevel[id], g_iPlayerXP[id]);
		SQL_TQuery(g_SQLConnection, SQL_InsertData_Callback, szInsertQuery);
	}
	else
	{
		//Data Saved
		server_print("[Level System] Data saved for a player.");
	}
}

public SQL_InsertData_Callback(Handle:hTuple, Result:iResult, const szError[])
{
	// Error handling for inserting data
	if (iResult == SQL_ERROR)
	{
		server_print("[Level System] ERROR: Could not insert data. %s", szError);
		return;
	}

	server_print("[Level System] New player data inserted.");
}


// Function to load player data from the database
// Error handling: Checks for database availability and query errors.
// Debugging: Prints load status to the server console.
stock load_player_data(id)
{
	if (!g_bDatabaseAvailable)
	{
		server_print("[Level System] Database not available, skipping load.");
		return;
	}

	new szAuthID[64];
	get_user_authid(id, szAuthID, charsmax(szAuthID));

	new szQuery[SQL_QUERY_MAX_LENGTH];
	formatex(szQuery, charsmax(szQuery), "SELECT `level`, `xp` FROM `%s` WHERE `authid` = '%s'", DATABASE_TABLE, szAuthID);

	SQL_TQuery(g_SQLConnection, SQL_LoadData_Callback, szQuery, id);
}

public SQL_LoadData_Callback(Handle:hTuple, Result:iResult, const szError[], id)
{
	// Error handling for loading data
	if (iResult == SQL_ERROR)
	{
		server_print("[Level System] ERROR: Could not load data. %s", szError);
		return;
	}

	// Check if any rows were returned
	if (SQL_NumResults(hTuple) > 0)
	{
		// Fetch the data
		SQL_NextRow(hTuple);

		// Read the level and XP
		g_iPlayerLevel[id] = SQL_ReadResult(hTuple, 0);
		g_iPlayerXP[id] = SQL_ReadResult(hTuple, 1);

		server_print("[Level System] Data loaded for player %d. Level: %d, XP: %d", id, g_iPlayerLevel[id], g_iPlayerXP[id]);
	}
	else
	{
		// Player data not found, use default values
		g_iPlayerLevel[id] = 1;
		g_iPlayerXP[id] = 0;

		server_print("[Level System] No data found for player %d. Using default values.", id);
	}
}