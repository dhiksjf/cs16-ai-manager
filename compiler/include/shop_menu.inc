/*
 * shop_menu.inc
 * Author: AMX Mod X Master Developer
 * Date: [Current Date]
 * Description: Manages the shop menu creation and display.
 *
 * Instructions:
 * 1. Place this file in the 'include' folder of your AMX Mod X installation.
 * 2. Include this file in your plugin using: #include "shop_menu.inc"
 *
 * Notes:
 * - This file provides functions to create and display the shop menu.
 */

#if defined _shop_menu_included
 #endinput
#endif
#define _shop_menu_included

#include <amxmodx>
#include <amxmisc>
#include <menu>
#include "shop_constants.inc"
#include "shop_database.inc"
#include "shop_utils.inc"

new g_iMenu[MAX_PLAYERS+1] = {0, ...};

// Define a custom menu handler for the shop menu.
// This function will be called when a player selects an item in the menu.
// id: The player's ID.
// key: The key that the player pressed (1-9, 0 for 10).
stock public menu_handler_shop(id, key)
{
	new szInfo[32], iLen

	new iName[64];

	new iAccess, iCallBack

	menu_item_getinfo(g_iMenu[id], key, iAccess, iName, charsmax(iName), szInfo, charsmax(szInfo), iCallBack)

	new item_id = str_to_num(szInfo);

	// Handle the selected item based on its ID.
	switch (item_id)
	{
		case MENU_ACTIONS_EXIT:
		{
			// Close the menu.
			menu_destroy(g_iMenu[id])
			g_iMenu[id] = 0
			return MENU_CLOSE
		}

		case MENU_ACTIONS_BACK:
		{
			// Go back to the main menu.
			ShowShopMenu(id)
			return MENU_CLOSE
		}

		default:
		{
			// Handle the selected item (item_id is the database ID).
			// Example: Buy the item, equip the item, etc.
			// You can call a function here to handle the item purchase.
			// For example:
			attempt_purchase(id, item_id)
			return MENU_CLOSE
		}

	}

	return MENU_CONTINUE
}

// Function to create the shop menu.
// id: The player's ID.
// Returns: The menu ID, or -1 on error.
stock CreateShopMenu(id)
{
	// Create the menu.
	new menu = menu_create("Shop Menu", "menu_handler_shop")

	//Check for valid menu
	//if(menu == -1)
	//{
	//	log_amx("[Shop System] Error creating menu.")
	//	return -1
	//}

	// Add items to the menu.
	// Example:
	// menu_additem(menu, "Item 1", "1", 0)
	// menu_additem(menu, "Item 2", "2", 0)

	// Fetch categories from the database.
	new g_SQLResult:query = db_query_result("SELECT id, name FROM `shop_categories`")

	if (query == INVALID_HANDLE)
	{
		// Handle database error.
		log_amx("[Shop System] Error fetching categories from the database.")
		return -1
	}

	new iNumCategories = SQL_NumResults(query)

	if (iNumCategories > 0)
	{
		new szCategoryName[MAX_ITEM_NAME_LENGTH]
		new iCategoryId

		for (new i = 0; i < iNumCategories; i++)
		{
			SQL_NextRow(query)

			// Read category ID and name from the database.
			SQL_ReadResult(query, 0, iCategoryId)
			SQL_ReadResult(query, 1, szCategoryName, charsmax(szCategoryName))

			// Format item data.
			new szInfo[32]
			num_to_str(iCategoryId, szInfo, charsmax(szInfo))

			// Add the category to the menu. The category ID is stored in the info field.
			menu_additem(menu, szCategoryName, szInfo, 0)
		}
	}
	else
	{
		menu_additem(menu, "No categories available.", "0", 0)
	}

	SQL_FreeHandle(query)

	new szExitInfo[32];
	num_to_str(MENU_ACTIONS_EXIT, szExitInfo, charsmax(szExitInfo));
	menu_additem(menu, "Exit", szExitInfo, 0)

	// Set the menu callback function.
	menu_setprop(menu, MPROP_EXIT, MEXIT_ALL)

	return menu
}

// Example function to attempt an item purchase. Adapt as needed
stock attempt_purchase(id, item_id)
{
	// Implement logic to:
	// 1. Check if the player has enough currency.
	// 2. Deduct the currency from the player's account.
	// 3. Give the player the item.
	// 4. Display a message to the player.

	// Load the item data from the database.
	if(load_item_data(item_id))
	{
		// Item found, perform purchase logic.
		new player_credits = get_player_credits(id)
		new item_cost = get_item_cost(item_id)

		// Verify player has enough credits
		if(player_credits >= item_cost)
		{
			//Deduct Credits
			set_player_credits(id, player_credits - item_cost)

			//Give Item - This will have to be expanded to give the item
			client_print(id, PRINT_CHAT, "[Shop] You have purchased the item.")
		}
		else
		{
			client_print(id, PRINT_CHAT, "[Shop] You do not have enough credits to buy this item.")
		}
	}
	else
	{
		//Item not found.
		client_print(id, PRINT_CHAT, "[Shop] Item not found.")
	}

}

// Dummy functions for credit management and item cost retrieval.  Replace with actual implementations.
stock get_player_credits(id)
{
	// Replace with your actual implementation to get the player's credits.
	// This is just a placeholder.
	return 500 //Example Value
}

stock set_player_credits(id, credits)
{
	// Replace with your actual implementation to set the player's credits.
	// This is just a placeholder.
	//For example, using Vault.
	return
}

stock get_item_cost(item_id)
{
	// Replace with your actual implementation to get the item's cost from the database.
	// This is just a placeholder.
	return 100 //Example Value
}