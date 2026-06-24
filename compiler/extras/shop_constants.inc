/*
 * shop_constants.inc
 * Author: AMX Mod X Master Developer
 * Date: [Current Date]
 * Description: Defines constants for the shop system plugin.
 *
 * Instructions:
 * 1. Place this file in the 'include' folder of your AMX Mod X installation.
 * 2. Include this file in your plugin using: #include "shop_constants.inc"
 *
 * Notes:
 * - This file defines constants used throughout the shop system.
 * - Modify these constants to customize the shop system's behavior.
 */

#if defined _shop_constants_included
 #endinput
#endif
#define _shop_constants_included

// Maximum length for item names, descriptions, etc.
#define MAX_ITEM_NAME_LENGTH 32
#define MAX_ITEM_DESCRIPTION_LENGTH 128

// Maximum number of items in a shop category
#define MAX_ITEMS_PER_CATEGORY 16

// Maximum number of shop categories
#define MAX_SHOP_CATEGORIES 8

// Define the base cost for a retry (example).
#define RETRY_BASE_COST 100

// Define the damage value for a specific weapon.
#define WEAPON_DAMAGE_AMOUNT 25

// Constants for menu display
#define MENU_ACTIONS_EXIT    8
#define MENU_ACTIONS_BACK    9

// Define the currency name
#define CURRENCY_NAME "Credits"

// Database related constants
#define DATABASE_HOST "localhost"  // Replace with your database host
#define DATABASE_USER "root"       // Replace with your database username
#define DATABASE_PASS ""           // Replace with your database password
#define DATABASE_NAME "cs16_shop"   // Replace with your database name

// Table names
#define ITEM_TABLE_NAME "shop_items"
#define CATEGORY_TABLE_NAME "shop_categories"

// Error messages (for debugging)
#define ERROR_DATABASE_CONNECT  "[Shop System] Failed to connect to the database."
#define ERROR_DATABASE_QUERY    "[Shop System] Database query error: %s"
#define ERROR_ITEM_NOT_FOUND    "[Shop System] Item not found."

// Admin flag to access admin shop commands.
#define ADMIN_ACCESS ADMIN_LEVEL_H // Example: Access level 'h' (ADMLVL_ADMIN)

// Constant for invalid menu page
#define INVALID_MENU_PAGE -1

//Debugging flag
#define DEBUG 1 // Set to 1 to enable debug messages, 0 to disable