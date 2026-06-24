/*
 * lvl_system_constants.inc
 * Author: AI Assistant
 * Description: Constants and defines for the level system plugin.
 */

#if defined _lvl_system_constants_included
 #endinput
#endif
#define _lvl_system_constants_included

// Plugin constants
#define LVLSYS_TAG "^4[^3Level System^4]"

// Database constants
#define DATABASE_HOST "localhost" // Change this to your database host
#define DATABASE_USER "root"      // Change this to your database user
#define DATABASE_PASS ""          // Change this to your database password
#define DATABASE_NAME "cs16_levels" // Change this to your database name
#define DATABASE_TABLE "player_levels" // Change this to your desired table name

//Error message constantsn#define LVLSYS_ERROR_DB_CONNECT  "[Level System] ERROR: Could not connect to database. Check your database settings in lvl_system_constants.inc"

//SQL Query definesn#define SQL_QUERY_MAX_LENGTH 256

// Function Prototypes (forward declarations)nforward load_configurations();nforward initialize_database();nforward save_player_data(id);
forward load_player_data(id);nforward check_level_up(id);
forward get_xp_required_for_next_level(iLevel);
forward show_top15(id);nforward read_config_int(const szFile[], const szKey[], iDefault);n