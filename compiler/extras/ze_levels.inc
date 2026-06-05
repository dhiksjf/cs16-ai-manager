/*
* Description:	Called on everytime a player levels up.
*
* @param id		Client index.
*
* @return		This forward ignores returns.
*/
forward ze_on_levelup(id)

/*
* Description:	Get players xp.
*
* @param id		Client index.
*
* @return		Player xp if player connected.
*				false | If player not connected.
*
* @note			This native will throw error if player not in the server.
*/
native ze_get_user_xp(id)

/*
* Description:	Set players xp.
*
* @param id		Client index.
* @param iXP	XP to set for this player.
*
* @return		true  | If successfully set.
*				false | If player not connected.
*
* @note			This native will throw error if player not in the server.
*/
native ze_set_user_xp(id, iXP)

/*
* Description:	Get players level.
*
* @param id		Client index.
*
* @return		Player level if player connected.
*				false | If player not connected.
*
* @note			This native will throw error if player not in the server.
*/
native ze_get_user_level(id)

/*
* Description:	Set players level.
*
* @param id		Client index.
* @param iLevel Level to set to player.
*
* @return		true  | If successfully set.
*				false | If player not connected.
*
* @note			This native will throw error if player not in the server.
*/
native ze_set_user_level(id, iLevel)

/*
* Description:	Get players current level max-xp.
*
* @param id		Client index.
*
* @return		Player current level max-xp.
*				false | If player not connected.
*
* @note			This native will throw error if player not in the server.
* 				Mean by user max-xp: PlayerXP/MaxXP (this for specific level).
*				Max-XP increase by level increase.
*/
native ze_get_user_max_xp(id)