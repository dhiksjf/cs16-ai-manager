/*
 * Utility Functions Include File (utils.inc)
 *
 * This file defines general utility functions used throughout the plugin.
 */

#if defined _utils_included
 #endinput
#endif
#define _utils_included

// Includes (Add any necessary includes here)
#include <amxmodx>

// Define any constants here
#define DEBUG 1 // Set to 1 to enable debug messages, 0 to disable

// Function Declarations

/**
 * @brief Prints a debug message to the server console if debugging is enabled.
 *
 * @param fmt The format string.
 * @param ... The arguments to the format string.
 */
native DebugPrint(const fmt[], ...);


// Implementation

public DebugPrint(const fmt[], ...)
{
	// Only print if debugging is enabled
	#if DEBUG
	new string[256];

vformat(string, charsmax(string), fmt, 2);
	server_print("[ESS Debug] %s", string);
	#endif
}


/*
// Example Usage:

#include "utils.inc" // Include this file in your plugin.

public plugin_init()
{
	DebugPrint("Plugin initialized."); // This will print if DEBUG is 1

	new some_variable = 42;
	DebugPrint("The value of some_variable is: %d", some_variable); //Example with an integer

	new Float:some_float = 3.14159;
	DebugPrint("The value of some_float is: %f", some_float); //Example with a float

	new const some_string[] = "Hello World!";
	DebugPrint("The value of some_string is: %s", some_string); //Example with a string
}
*/

/*
 * Instructions:
 *
 * 1.  Include this file in your plugin: #include "utils.inc"
 * 2.  Use the DebugPrint function to print debug messages to the server console.
 * 3.  Set the DEBUG constant to 1 to enable debugging, or 0 to disable it.
 *
 * Error Handling:
 *
 *  - The DebugPrint function will only print messages if DEBUG is set to 1.
 *  - If DEBUG is set to 0, the DebugPrint function will do nothing.
 *
 * Debugging Info:
 *
 *  - Debug messages will be prefixed with "[ESS Debug]" to distinguish them from other server messages.
 */
