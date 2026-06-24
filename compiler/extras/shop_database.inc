/*
 * shop_database.inc
 * Author: AMX Mod X Master Developer
 * Date: [Current Date]
 * Description: Handles database interactions for the shop system.
 *
 * Instructions:
 * 1. Place this file in the 'include' folder of your AMX Mod X installation.
 * 2. Include this file in your plugin using: #include "shop_database.inc"
 *
 * Notes:
 * - Requires the MySQL module to be installed and enabled on the server.
 * - Configure database credentials in shop_constants.inc.
 */

#if defined _shop_database_included
 #endinput
#endif
#define _shop_database_included

#include <amxmodx>
#include <sqlx>
#include "shop_constants.inc"

// Global database variables
new g_SQLTuple:g_SQLConnection = SQL_NULL
new bool:g_bDatabaseConnected = false

// Function to connect to the database
stock db_connect()
{
	// Attempt to connect to the database
	SQL_FreeHandle(g_SQLConnection); // Free previous connection if any
	g_SQLConnection = SQL_MakeDbTuple(DATABASE_HOST, DATABASE_USER, DATABASE_PASS, DATABASE_NAME)

	if(SQL_Connect(g_SQLConnection))
	{
		g_bDatabaseConnected = true
		#if DEBUG
		log_amx("[Shop System] Connected to database.")
		#endif
		return 1; // Success
	}
	else
	{
		g_bDatabaseConnected = false
		log_amx(ERROR_DATABASE_CONNECT)
		return 0; // Failure
	}
}

// Function to disconnect from the database
stock db_disconnect()
{
	if(g_bDatabaseConnected)
	{
		SQL_FreeHandle(g_SQLConnection)
		g_bDatabaseConnected = false
		#if DEBUG
		log_amx("[Shop System] Disconnected from database.")
		#endif
	}
}

// Function to execute a SQL query
// Returns: 1 on success, 0 on failure
stock db_query(const szQuery[], any:...)
{
	new szFormattedQuery[512]; // Increased buffer size
	new iLen = vformat(szFormattedQuery, charsmax(szFormattedQuery), szQuery, 3); // Store the returned length.

	if (iLen == 0)
	{
		log_amx("[Shop System] Empty query.");
		return 0;
	}

	new g_SQLQuery:query = SQL_Query(g_SQLConnection, szFormattedQuery)

	if(query == INVALID_HANDLE)
	{
		new szError[256]
		SQL_GetError(g_SQLConnection, szError, charsmax(szError))
		new szErrorMessage[512];
		format(szErrorMessage, charsmax(szErrorMessage), ERROR_DATABASE_QUERY, szError)
		log_amx(szErrorMessage)
		return 0; // Failure
	}

	SQL_FreeHandle(query)
	return 1; // Success
}

// Function to execute a SQL query and fetch results
// Returns: g_SQLResult on success, INVALID_HANDLE on failure
stock g_SQLResult:db_query_result(const szQuery[], any:...)
{
	new szFormattedQuery[512]; // Increased buffer size
	new iLen = vformat(szFormattedQuery, charsmax(szFormattedQuery), szQuery, 3); // Store the returned length.

	if (iLen == 0)
	{
		log_amx("[Shop System] Empty query.");
		return INVALID_HANDLE;
	}

	new g_SQLResult:query = SQL_Query(g_SQLConnection, szFormattedQuery)

	if(query == INVALID_HANDLE)
	{
		new szError[256]
		SQL_GetError(g_SQLConnection, szError, charsmax(szError))
		new szErrorMessage[512];
		format(szErrorMessage, charsmax(szErrorMessage), ERROR_DATABASE_QUERY, szError)
		log_amx(szErrorMessage)
		return INVALID_HANDLE; // Failure
	}

	return query; // Return the query result handle
}

// Example function to load item data from the database
// (Adapt this to your specific database schema)
stock load_item_data(item_id)
{
	if(!g_bDatabaseConnected)
	{
		log_amx("[Shop System] Database not connected. Cannot load item data.")
		return 0
	}

	new szQuery[128]
	format(szQuery, charsmax(szQuery), "SELECT * FROM `%s` WHERE `id` = '%d'", ITEM_TABLE_NAME, item_id)

	new g_SQLResult:query = db_query_result(szQuery)

	if (query != INVALID_HANDLE)
	{
		// Check if any rows were returned
		new iNumResults = SQL_NumResults(query);
		if (iNumResults > 0)
		{
			SQL_NextRow(query)

			// Example: Get item name
			new szItemName[MAX_ITEM_NAME_LENGTH]
			SQL_ReadResult(query, 1, szItemName, charsmax(szItemName))

			// Do something with the item data (e.g., store it in an array)
			#if DEBUG
			log_amx("[Shop System] Loaded item: %s", szItemName)
			#endif
			SQL_FreeHandle(query)
			return 1
		}
		else
		{
			log_amx(ERROR_ITEM_NOT_FOUND)
			SQL_FreeHandle(query)
			return 0
		}
	}

	return 0
}