// include/constants.inc

#if defined _constants_included
 #endinput
#endif
#define _constants_included

// This include file defines constant values used throughout the plugin.
//
// Setup Instructions:
// 1. Place this file in the "include" directory of your AMX Mod X installation.
// 2. Include this file in your main plugin file and any other include files that need access to these constants: #include "constants.inc"
//
// Debugging:
// - Use log_amx() to print debug information if a constant's value is not what you expect.

// Define file extensions for data storage
#define ECONOMY_FILE_EXT ".eco" // File extension for economy data
#define SKILLS_FILE_EXT ".skl"  // File extension for skills data

// Define maximum lengths for strings
#define MAX_ITEM_NAME_LENGTH 64   // Maximum length for item names
#define MAX_ITEM_DESCRIPTION_LENGTH 256 // Maximum length for item descriptions

// Define menu title
#define SHOP_MENU_TITLE_STRING "\y[Economy Shop]\w"

// Define admin command tag
#define ADMIN_COMMAND_TAG "[EconomySkillShop]"

// Define the base XP required to level up
#define BASE_XP_REQUIRED 100

// Define chat tag
#define CHAT_TAG "^4[^1Economy^4]"

//Useful Macros
#define is_valid_ent(%0) (%0 > 0 && %0 <= gpGlobals.maxEntities)

// Error Handling:
// - Ensure that any code using these constants handles potential errors (e.g., file not found, invalid data).

// Debugging Info:
// - Use log_amx() to print debug information to the server log file if needed.
