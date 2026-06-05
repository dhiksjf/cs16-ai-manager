/*
 * Shop System Include File (shop.inc)
 *
 * This file defines functions and constants related to the in-game shop system.
 */

#if defined _shop_included
 #endinput
#endif
#define _shop_included

// Constants
#define MAX_SHOP_ITEMS 32 // Maximum number of items in the shop
#define MAX_ITEM_NAME_LENGTH 64
#define MAX_SHOP_CATEGORIES 8
#define MAX_CATEGORY_NAME_LENGTH 32

// Item Flags
#define ITEM_FLAG_WEAPON  (1<<0) // Item is a weapon
#define ITEM_FLAG_AMMO    (1<<1) // Item is ammo
#define ITEM_FLAG_PERK    (1<<2) // Item is a perk
#define ITEM_FLAG_ABILITY (1<<3) // Item is a special ability

// Data Structures
struct ShopItem
{
 int id;                // Unique item ID
 char name[MAX_ITEM_NAME_LENGTH]; // Item name
 int cost;                // Item cost
 int category;            // Item category ID
 int flag; // Item flags (weapon, ammo, perk, ability)
 char command[64];        // Command to execute when the item is purchased
 int cooldown;          // Cooldown in seconds after purchase
 int stock;             // Stock available (if limited)
 int max_stock_per_player; // Maximum stock per player (if limited)
 float duration;       // Duration of the item effect (e.g., perk duration)
}; //REMEMBER to initialize this struct when declaring variables of this type

struct ShopCategory
{
 int id;
 char name[MAX_CATEGORY_NAME_LENGTH];
};

// Global Variables
new g_ShopItems[MAX_SHOP_ITEMS];
new g_NumShopItems = 0;
new g_ShopCategories[MAX_SHOP_CATEGORIES];
new g_NumShopCategories = 0;
new g_ItemCooldowns[33][MAX_SHOP_ITEMS]; // [playerid][itemid]
new g_ItemStock[MAX_SHOP_ITEMS]; // Current stock for each item
new g_PlayerItemStock[33][MAX_SHOP_ITEMS]; // Player specific item stock

// Forward Declarations
forward Shop_ItemPurchased(playerid, itemid);

// Function Declarations

/**
 * @brief Initializes the shop system.
 *        This function is called during plugin initialization.
 */
native Shop_Init();

/**
 * @brief Adds a new item to the shop.
 *
 * @param name      The name of the item.
 * @param cost      The cost of the item.
 * @param category  The category ID of the item.
 * @param command   The command to execute when the item is purchased.
 * @return          The ID of the newly created item, or -1 on failure.
 */
native Shop_AddItem(const name[], cost, category, flag, const command[], cooldown, stock, max_stock_per_player, Float:duration);

/**
 * @brief Removes an item from the shop.
 *
 * @param itemid  The ID of the item to remove.
 * @return        True on success, false on failure.
 */
native Shop_RemoveItem(itemid);

/**
 * @brief Opens the shop menu for a player.
 *
 * @param playerid The ID of the player to open the shop for.
 */
native Shop_OpenMenu(playerid);

/**
 * @brief Handles the purchase of an item.
 *
 * @param playerid The ID of the player purchasing the item.
 * @param itemid   The ID of the item being purchased.
 */
native Shop_BuyItem(playerid, itemid);

/**
 * @brief Adds a new category to the shop.
 *
 * @param name The name of the category.
 * @return     The ID of the newly created category, or -1 on failure.
 */
native Shop_AddCategory(const name[]);

/**
 * @brief Gets the price of a specific item.
 *
 * @param itemid The ID of the item.
 * @return       The cost of the item, or -1 if the item is not found.
 */
native Shop_GetItemCost(itemid);

/**
 * @brief Gets the name of a specific item.
 *
 * @param itemid The ID of the item.
 * @param name   String to store the item's name.
 * @param len    Maximum length of the name string.
 * @return       True on success, false on failure.
 */
native Shop_GetItemName(itemid, name[], len);


/**
 * @brief Gets the Category ID of a specific item.
 *
 * @param itemid The ID of the item.
 * @return       Category ID, or -1 if not found.
 */
native Shop_GetItemCategory(itemid);

/**
 * @brief Gets the number of available items in the shop
 *
 * @return       The total items.
 */
native Shop_GetItemCount();


// Implementation

public Shop_Init()
{
 // Initialize shop-related data here.
 // Example: Loading shop items from a file or database.
 server_print("[ESS] Shop System Initialized.");

 // Initialize global variables
 for (new i = 0; i < MAX_SHOP_ITEMS; i++)
 {
  g_ShopItems[i] = -1; // Mark as empty
  g_ItemStock[i] = -1; // Initialize stock
 }

 for (new i = 0; i < MAX_SHOP_CATEGORIES; i++)
 {
  g_ShopCategories[i] = -1; // Mark as empty
 }

 g_NumShopItems = 0;
 g_NumShopCategories = 0;

 // Add some default categories
 Shop_AddCategory("Weapons");  // Category ID 0
 Shop_AddCategory("Ammo");     // Category ID 1
 Shop_AddCategory("Perks");     // Category ID 2
 Shop_AddCategory("Abilities"); // Category ID 3

 //Add some default Items
 Shop_AddItem("AK-47", 2700, 0, ITEM_FLAG_WEAPON, "weapon_ak47", 0, -1, -1, 0.0); //Weapon, infinite stock.
 Shop_AddItem("M4A1", 3100, 0, ITEM_FLAG_WEAPON, "weapon_m4a1", 0, -1, -1, 0.0); //Weapon, infinite stock.
 Shop_AddItem("Extra Ammo", 300, 1, ITEM_FLAG_AMMO, "amx_givemoney %userid% 500", 0, -1, -1, 0.0); //Gives Money as placeholder, infinite stock.
 Shop_AddItem("Speed Boost", 1500, 2, ITEM_FLAG_PERK, "amx_cvar sv_accelerate 5", 60, -1, -1, 30.0); //Temporary Speed Boost
}

public Shop_AddItem(const name[], cost, category, flag, const command[], cooldown, stock, max_stock_per_player, Float:duration)
{
 if (g_NumShopItems >= MAX_SHOP_ITEMS)
 {
  server_print("[ESS] Shop is full. Cannot add more items.");
  return -1;
 }

 new itemid = g_NumShopItems;
 copy(g_ShopItems[itemid].name, charsmax(g_ShopItems[itemid].name), name);
 g_ShopItems[itemid].cost = cost;
 g_ShopItems[itemid].category = category;
 g_ShopItems[itemid].command = command; // Directly copy the command string
 g_ShopItems[itemid].flag = flag;
 g_ShopItems[itemid].cooldown = cooldown;
 g_ShopItems[itemid].stock = stock;
 g_ShopItems[itemid].max_stock_per_player = max_stock_per_player;
 g_ShopItems[itemid].duration = duration;

 if (stock > 0)
  g_ItemStock[itemid] = stock; // Set the starting stock if limited
 else
  g_ItemStock[itemid] = -1; //Unlimited Stock

 g_NumShopItems++;
 return itemid;
}

public Shop_RemoveItem(itemid)
{
 if (itemid < 0 || itemid >= g_NumShopItems)
 {
  server_print("[ESS] Invalid item ID.");
  return false;
 }

 // Mark the item as removed (you might want to shift items to fill the gap)
 g_ShopItems[itemid].cost = -1; // Mark as invalid
 g_ShopItems[itemid].name = "";

 return true;
}

public Shop_OpenMenu(playerid)
{
 new menu = menu_create("Shop Menu", "ShopMenuHandler");

 new szItemName[MAX_ITEM_NAME_LENGTH];
 new szMenuItem[64];

 for (new i = 0; i < g_NumShopItems; i++)
 {
  if (g_ShopItems[i].cost != -1) // Skip removed items
  {
   Shop_GetItemName(i, szItemName, charsmax(szItemName));
   formatex(szMenuItem, charsmax(szMenuItem), "%s ($%d)", szItemName, g_ShopItems[i].cost);
   menu_additem(menu, szMenuItem, itoa(i));
  }
 }

 menu_setprop(menu, MP_EXIT, "Exit");
 menu_display(playerid, menu, 0);
 return PLUGIN_HANDLED;
}

public ShopMenuHandler(playerid, menu, item)
{
 if (item == MENU_EXIT)
 {
  menu_destroy(menu);
  return PLUGIN_HANDLED;
 }

 new itemid = str_to_num(menu_getitem(menu, item, 0));
 menu_destroy(menu);

 Shop_BuyItem(playerid, itemid);

 return PLUGIN_CONTINUE;
}

public Shop_BuyItem(playerid, itemid)
{
 if (itemid < 0 || itemid >= g_NumShopItems)
 {
  client_print(playerid, print_chat, "[ESS] Invalid item ID.");
  return;
 }

 if (g_ShopItems[itemid].cost == -1)
 {
  client_print(playerid, print_chat, "[ESS] This item is no longer available.");
  return;
 }

 if (g_ItemCooldowns[playerid][itemid] > get_time())
 {
  new time_left = g_ItemCooldowns[playerid][itemid] - get_time();
  client_print(playerid, print_chat, "[ESS] This item is on cooldown. Please wait %d seconds.", time_left);
  return;
 }

 // Check if the item has limited stock
 if (g_ItemStock[itemid] == 0)
 {
  client_print(playerid, print_chat, "[ESS] This item is out of stock.");
  return;
 }

 //Check player specific item stock.
 if(g_ShopItems[itemid].max_stock_per_player != -1 && g_PlayerItemStock[playerid][itemid] >= g_ShopItems[itemid].max_stock_per_player)
 {
  client_print(playerid, print_chat, "[ESS] You have reached the maximum stock for this item.");
  return;
 }

 new cost = Shop_GetItemCost(itemid);
 if (GetPlayerMoney(playerid) >= cost)
 {
  if (TakePlayerMoney(playerid, cost))
  {
   // Execute the item's command
   new szCommand[256];
   copy(szCommand, charsmax(szCommand), g_ShopItems[itemid].command);
   replace_all(szCommand, charsmax(szCommand), "%userid%", itoa(playerid));
   server_cmd(szCommand);
   server_print("[ESS] Executed command: %s", szCommand);

   // Set the cooldown
   g_ItemCooldowns[playerid][itemid] = get_time() + g_ShopItems[itemid].cooldown;

   // Reduce the stock if limited
   if (g_ItemStock[itemid] > 0)
   {
    g_ItemStock[itemid]--;
   }

   //Increase the player specific stock.
   if (g_ShopItems[itemid].max_stock_per_player != -1)
   {
    g_PlayerItemStock[playerid][itemid]++;
   }

   // Item Purchased Callback
   Shop_ItemPurchased(playerid, itemid);
  }
 }
 else
 {
  client_print(playerid, print_chat, "[ESS] Not enough money!");
 }
}

public Shop_AddCategory(const name[])
{
 if (g_NumShopCategories >= MAX_SHOP_CATEGORIES)
 {
  server_print("[ESS] Max shop categories reached.");
  return -1;
 }

 new categoryid = g_NumShopCategories;
 copy(g_ShopCategories[categoryid].name, charsmax(g_ShopCategories[categoryid].name), name);
 g_NumShopCategories++;
 return categoryid;
}

public Shop_GetItemCost(itemid)
{
 if (itemid < 0 || itemid >= g_NumShopItems)
 {
  return -1;
 }

 return g_ShopItems[itemid].cost;
}

public Shop_GetItemName(itemid, name[], len)
{
 if (itemid < 0 || itemid >= g_NumShopItems)
 {
  return false;
 }

 copy(name, len, g_ShopItems[itemid].name);
 return true;
}

public Shop_GetItemCategory(itemid)
{
 if (itemid < 0 || itemid >= g_NumShopItems)
 {
  return -1;
 }

 return g_ShopItems[itemid].category;
}

public Shop_GetItemCount()
{
 return g_NumShopItems;
}


// Callback Implementation
public Shop_ItemPurchased(playerid, itemid)
{
 // This callback can be used to add custom logic when an item is purchased.
 // For example, you could give the player a specific weapon or apply a perk.
 server_print("[ESS] Player %d purchased item %d.", playerid, itemid);

 new szItemName[MAX_ITEM_NAME_LENGTH];
 Shop_GetItemName(itemid, szItemName, charsmax(szItemName));
 client_print(playerid, print_chat, "[ESS] You purchased %s!", szItemName);
}


/*
// Example of loading shop items from a config file.
stock Shop_LoadConfigValues(szConfigFile[])
{
 new ini = ini_open(szConfigFile);

 if (ini != INVALID_HANDLE)
 {
  new section[32];
  new itemIndex = 0;

  while (ini_nextsection(ini, section, 31))
  {
   if (containi(section, "ShopItem") != -1)
   {
    new name[64], command[64];
    new cost, category;

    ini_getkey(ini, section, "Name", name, 63);
    ini_getkey(ini, section, "Cost", cost, 15);
    ini_getkey(ini, section, "Category", category, 15);
    ini_getkey(ini, section, "Command", command, 63);

    Shop_AddItem(name, str_to_num(cost), str_to_num(category), command);

    itemIndex++;
   }
  }

  ini_close(ini);
  server_print("[ESS] Shop config values loaded.");
 }
 else
 {
  server_print("[ESS] Failed to open shop config file.");
 }
}
*/
