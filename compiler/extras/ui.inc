// include/ui.inc

#if defined _ui_included
 #endinput
#endif
#define _ui_included

// Include necessary headers
#include <amxmodx>
#include <amxmisc>

// Function: UI_Init
// Description: Initializes the UI system.
// Notes: Called during plugin initialization.
//       This can include setting up any HUD messages, chat colors, etc.
forward UI_Init();
public UI_Init()
{
	// Initialize any UI elements here.
	// For example, setting up custom chat colors or HUD messages.
	// For now, it's empty.
	log_amx("[UI] Initialized.");
}

// Function: UI_DisplayMessage
// Description: Displays a formatted message to a player in chat.
// Parameters:
//   id - The player ID.
//   const message[] - The message to display.
//   ... - Optional formatting arguments.
// Example:
//   UI_DisplayMessage(id, "^4[^1Economy^4] You have ^3$%d^4.", Economy_GetMoney(id));
stock UI_DisplayMessage(id, const message[], ...)
{
	new buffer[256];
	vformat(buffer, charsmax(buffer), message, 3);
	client_print(id, PRINT_CHAT, buffer);
}

// Function: UI_UpdateHUD
// Description: Updates the player's HUD with relevant information.
// Parameters:
//   id - The player ID.
// Example:
//   UI_UpdateHUD(id); // Call this regularly to update the HUD
stock UI_UpdateHUD(id)
{
	// Example HUD update (using set_hudmessage):
	new money = Economy_GetMoney(id);
	new xp = Skills_GetXP(id);
	new level = Skills_GetLevel(id);

	set_hudmessage(0.0, 1.0, 0.0, -1.0, 0.05, 0, 6.0, 2.0, 1, 150, 2);
	show_hudmessage(id, "Money: $%d | XP: %d | Level: %d", money, xp, level);
}

// Example Usage (in other files):
// - To display a message: UI_DisplayMessage(id, "^1Error:^3 Insufficient funds.");
// - To update the HUD: UI_UpdateHUD(id);

// Setup Instructions:
// 1. Include this file in your main plugin file: #include "ui.inc"
// 2. Call UI_Init() in plugin_init() to initialize the UI system.
// 3. Use UI_DisplayMessage() to display formatted messages to players.
// 4. Use UI_UpdateHUD() to update the player's HUD with information (call it regularly, e.g., in a task).

// Error Handling:
// - Check if the player ID is valid before calling UI functions (is_user_connected(id)).
// - Handle any potential errors related to HUD message display.

// Debugging Info:
// - Use log_amx() to print debug information to the server log file if needed.
