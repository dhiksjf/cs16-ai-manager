/*
 * lvl_system_utils.inc
 * Author: AI Assistant
 * Description: Utility functions for the level system plugin.
 */

#if defined _lvl_system_utils_included
 #endinput
#endif
#define _lvl_system_utils_included

#include <amxmodx>

// Function to strip color codes from a string
// Useful for cleaning player names before displaying them.
stock strip_color_codes(const szString[], szResult[], iResultLen)
{
	new i, j, len = strlen(szString);

	j = 0;
	for (i = 0; i < len && j < iResultLen - 1; i++)
	{
		// Color code detected
		// Color codes are ^1, ^2, ..., ^9, ^0
		// We skip the '^' and the following digit.
		// Also skip any character with ASCII value below 32	
		
		 if (szString[i] == '^' && szString[i+1] >= '0' && szString[i+1] <= '9')
		{
			 i++; // Skip the digit
			 continue; // Continue to the next character
		}		
		
		// Normal character, copy it to the result string
		szResult[j++] = szString[i];
	}

	szResult[j] = 0; // Null-terminate the result string
}
