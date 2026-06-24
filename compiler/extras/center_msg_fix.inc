#if defined AMXX_VERSION_LOCAL_REV_NUM
	#define client_print CenterMsgFix_PrintMsg
	#define console_print CenterMsgFix_ConsolePrint
#endif

/**
 * Sends a message to the client.
 *
 * @param pPlayer     	Client index, use 0 to display to all clients
 * @param iMsgType     	Message type, see print_* destination constants in amxconst.inc
 * @param szMessage   	Formatting rules
 * @param ...       	Variable number of formatting parameters
 *
 * @noreturn
 */
native CenterMsgFix_PrintMsg(pPlayer, iMsgType, szMessage[], any:...);

/**
 * Sends a message to the client or to the server console.
 *
 * @param pPlayer     	Client index, use 0 to send to the server console
 * @param szMessage   	Formatting rules
 * @param ...       	Variable number of formatting parameters
 *
 * @noreturn
 */
native CenterMsgFix_ConsolePrint(pPlayer, szMessage[], any:...);