/* ==========================================================================
   ADVANCED HUD MENU SYSTEM (AHMS) - OMNI EDITION (v10.1 FIXED)
   "The Max Level HUD Solution"
   
   [FIXES v10.1]
   - Removed dependency on xs.inc to fix compilation errors.
   - Fixed xs_sin argument mismatch (now uses floatsin).
   - Fixed tag mismatches in ArrayGetArray/ArraySetArray.
   ========================================================================== */

#if defined _ahms_menu_included
    #endinput
#endif
#define _ahms_menu_included

#include <amxmodx>
#include <amxmisc>
#include <fakemeta>

/* ==========================================================================
   CONSTANTS & CONFIGURATION
   ========================================================================== */
#define AHMS_VERSION            "10.1"
#define AHMS_MAX_MENUS          64
#define AHMS_MAX_ITEMS          512
#define AHMS_BUF_SIZE           1024
#define AHMS_TITLE_LEN          128
#define AHMS_GLOBAL_TASK        49100
#define AHMS_SYNC_POOL_SIZE     4

#define AHMS_DEFAULT_REFRESH    0.1
#define AHMS_DEFAULT_THROTTLE   0.2
#define AHMS_ANIM_SPEED         5.0
#define AHMS_NULL_INDEX         -1

/* ==========================================================================
   ENUMERATIONS
   ========================================================================== */
enum AHMS_AnimType {
    ANIM_NONE = 0,
    ANIM_PULSE,
    ANIM_SHIMMER,
    ANIM_TYPEWRITER
};

enum AHMS_Status {
    AHMS_SHOW_ITEM = 0,
    AHMS_SKIP_ITEM = 1
};

/* ==========================================================================
   INTERNAL STRUCTURES
   ========================================================================== */
enum _:MenuDef {
    M_TITLE[AHMS_TITLE_LEN],
    M_CB_SELECT,
    M_CB_CONDITION,
    M_PARENT,
    
    // Styling
    AHMS_AnimType:M_ANIM,
    M_COLOR[3],
    Float:M_POS_X,
    Float:M_POS_Y,
    Float:M_TRANSITION,
    
    // Config
    M_ITEMS_PER_PAGE,
    Float:M_REFRESH,
    
    // Text overrides
    M_TXT_EXIT[32],
    M_TXT_BACK[32],
    M_TXT_NEXT[32],
    
    // Internals
    Array:M_ITEMS,
    bool:M_IS_VALID,
    M_GENERATION
};

enum _:ItemDef {
    I_NAME[96],
    I_ACCESS,
    I_USER_DATA,
    I_INFO_STR[32],
    bool:I_DISABLED,
    bool:I_USE_COLOR,
    I_COLOR[3]
};

enum _:PlayerState {
    PL_MENU_ID,
    PL_MENU_GEN,
    PL_PAGE,
    Float:PL_OPEN_TIME,
    Float:PL_LAST_ACT,
    Float:PL_NEXT_RENDER,
    
    PL_FILTER_TEXT[32],
    bool:PL_FILTER_ACTIVE,
    
    PL_MAP[AHMS_MAX_ITEMS],
    PL_TOTAL_CACHED,
    bool:PL_DIRTY_CACHE,
    bool:PL_IS_OPEN
};

// Globals
new Array:g_Menus = Invalid_Array;
new g_PlayerState[33][PlayerState];
new g_msgSync[AHMS_SYNC_POOL_SIZE];
new g_ActiveMenus = 0;
new bool:g_Init = false;

// Assets
new const SND_OPEN[] = "common/wpn_hudon.wav";
new const SND_SEL[]  = "common/wpn_select.wav";
new const SND_NEXT[] = "common/wpn_moveselect.wav";
new const SND_BACK[] = "common/wpn_hudoff.wav";
new const SND_ERR[]  = "buttons/button10.wav";

/* ==========================================================================
   1. CORE INITIALIZATION
   ========================================================================== */

stock AHMS_Init() {
    if (g_Init) return;
    
    g_Menus = ArrayCreate(MenuDef);
    g_Init = true;
    
    for(new i=0; i<AHMS_SYNC_POOL_SIZE; i++) 
        g_msgSync[i] = CreateHudSyncObj();
    
    precache_sound(SND_OPEN);
    precache_sound(SND_SEL);
    precache_sound(SND_NEXT);
    precache_sound(SND_BACK);
    precache_sound(SND_ERR);
    
    for(new i=0; i<10; i++) {
        new cmd[8]; formatex(cmd, 7, "slot%d", i);
        register_clcmd(cmd, "_AHMS_Input");
    }
}

stock AHMS_Destroy() {
    if (g_Menus != Invalid_Array) {
        new d[MenuDef];
        for(new i=0; i<ArraySize(g_Menus); i++) {
            ArrayGetArray(g_Menus, i, d);
            if(d[M_ITEMS] != Invalid_Array) ArrayDestroy(d[M_ITEMS]);
        }
        ArrayDestroy(g_Menus);
    }
}

/* ==========================================================================
   2. API: CREATION & CONFIG
   ========================================================================== */

stock AHMS_Create(const title[], const handler[], parent=AHMS_NULL_INDEX) {
    if(!g_Init) AHMS_Init();
    
    new d[MenuDef];
    
    new mid = -1, count = ArraySize(g_Menus);
    for(new i=0; i<count; i++) {
        ArrayGetArray(g_Menus, i, d);
        if(!d[M_IS_VALID]) { mid = i; d[M_GENERATION]++; break; }
    }
    
    if (mid == -1) {
        if(count >= AHMS_MAX_MENUS) return AHMS_NULL_INDEX;
        mid = count; 
        d[M_GENERATION] = 1;
        ArrayPushArray(g_Menus, d);
    }
    
    copy(d[M_TITLE], AHMS_TITLE_LEN-1, title);
    d[M_CB_SELECT] = get_func_id(handler, -1);
    d[M_CB_CONDITION] = -1;
    d[M_PARENT] = parent;
    
    d[M_ANIM] = ANIM_NONE;
    d[M_COLOR] = {255, 255, 255};
    d[M_POS_X] = -1.0;
    d[M_POS_Y] = 0.25;
    d[M_TRANSITION] = 0.0;
    
    d[M_ITEMS_PER_PAGE] = 14;
    d[M_REFRESH] = AHMS_DEFAULT_REFRESH;
    
    copy(d[M_TXT_EXIT], 31, "EXIT");
    copy(d[M_TXT_BACK], 31, "BACK");
    copy(d[M_TXT_NEXT], 31, "NEXT");
    
    d[M_ITEMS] = ArrayCreate(ItemDef);
    d[M_IS_VALID] = true;
    
    ArraySetArray(g_Menus, mid, d);
    return mid;
}

stock AHMS_SetStyle(mid, Float:x, Float:y, r=255, g=255, b=255, AHMS_AnimType:anim=ANIM_NONE, Float:transition=0.0) {
    if(!_Valid(mid)) return;
    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    d[M_POS_X]=x; d[M_POS_Y]=y;
    d[M_COLOR][0]=r; d[M_COLOR][1]=g; d[M_COLOR][2]=b;
    d[M_ANIM] = anim;
    d[M_TRANSITION]=transition;
    ArraySetArray(g_Menus, mid, d);
}

stock AHMS_SetCondition(mid, const func_name[]) {
    if(!_Valid(mid)) return;
    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    d[M_CB_CONDITION] = get_func_id(func_name, -1);
    ArraySetArray(g_Menus, mid, d);
}

/* ==========================================================================
   3. API: ITEMS
   ========================================================================== */

stock AHMS_AddItem(mid, const name[], access=0, data=0, const info[]="", bool:disabled=false) {
    if(!_Valid(mid)) return AHMS_NULL_INDEX;
    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    
    if(ArraySize(d[M_ITEMS]) >= AHMS_MAX_ITEMS) return AHMS_NULL_INDEX;
    
    new item[ItemDef];
    copy(item[I_NAME], 95, name);
    item[I_ACCESS] = access;
    item[I_USER_DATA] = data;
    copy(item[I_INFO_STR], 31, info);
    item[I_DISABLED] = disabled;
    item[I_USE_COLOR] = false;
    
    ArrayPushArray(d[M_ITEMS], item);
    return ArraySize(d[M_ITEMS])-1;
}

stock AHMS_AddItemF(mid, access, data, const fmt[], any:...) {
    new buf[96];
    vformat(buf, 95, fmt, 5);
    return AHMS_AddItem(mid, buf, access, data);
}

stock AHMS_SetItemColor(mid, item_idx, r, g, b) {
    if(!_Valid(mid)) return;
    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    if(item_idx < 0 || item_idx >= ArraySize(d[M_ITEMS])) return;

    new item[ItemDef]; ArrayGetArray(d[M_ITEMS], item_idx, item);
    item[I_USE_COLOR] = true;
    item[I_COLOR][0]=r; item[I_COLOR][1]=g; item[I_COLOR][2]=b;
    ArraySetArray(d[M_ITEMS], item_idx, item);
}

/* ==========================================================================
   4. API: CONTROL
   ========================================================================== */

stock AHMS_Open(id, mid) {
    if(!is_user_connected(id) || !_Valid(mid)) return;
    
    if(g_PlayerState[id][PL_MENU_ID] != mid) {
        g_PlayerState[id][PL_PAGE] = 0;
        g_PlayerState[id][PL_FILTER_ACTIVE] = false;
    }

    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    
    g_PlayerState[id][PL_MENU_ID] = mid;
    g_PlayerState[id][PL_MENU_GEN] = d[M_GENERATION];
    g_PlayerState[id][PL_OPEN_TIME] = get_gametime();
    g_PlayerState[id][PL_DIRTY_CACHE] = true;
    
    _AHMS_ToggleState(id, true);
    client_cmd(id, "spk %s", SND_OPEN);
    
    _AHMS_Draw(id, mid);
}

stock AHMS_Close(id) {
    if (g_PlayerState[id][PL_IS_OPEN]) {
        _AHMS_ToggleState(id, false);
        for(new i=0; i<AHMS_SYNC_POOL_SIZE; i++) ClearSyncHud(id, g_msgSync[i]);
    }
}

stock AHMS_Filter(id, const query[]) {
    if(query[0]) {
        copy(g_PlayerState[id][PL_FILTER_TEXT], 31, query);
        g_PlayerState[id][PL_FILTER_ACTIVE] = true;
    } else {
        g_PlayerState[id][PL_FILTER_ACTIVE] = false;
    }
    g_PlayerState[id][PL_DIRTY_CACHE] = true; 
}

/* ==========================================================================
   5. RENDER ENGINE
   ========================================================================== */

_AHMS_Draw(id, mid) {
    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    
    if(g_PlayerState[id][PL_DIRTY_CACHE]) _AHMS_BuildCache(id, mid, d);

    new total = g_PlayerState[id][PL_TOTAL_CACHED];
    new pp = d[M_ITEMS_PER_PAGE];
    new max_page = (total > 0) ? (total - 1) / pp : 0;
    
    if(g_PlayerState[id][PL_PAGE] > max_page) g_PlayerState[id][PL_PAGE] = max_page;
    new page = g_PlayerState[id][PL_PAGE];

    new start = page * pp;
    new end = min(start + pp, total);
    
    static l_col[AHMS_BUF_SIZE/2], r_col[AHMS_BUF_SIZE/2];
    static title_out[AHMS_TITLE_LEN];
    new l_len = 0, r_len = 0;
    
    l_len += formatex(l_col[l_len], (AHMS_BUF_SIZE/2)-l_len, "^n^n");
    r_len += formatex(r_col[r_len], (AHMS_BUF_SIZE/2)-r_len, "^n^n");

    new item[ItemDef], raw_idx;
    new split_point = (pp / 2) + (pp % 2);

    for(new i=start; i<end; i++) {
        if(l_len > (AHMS_BUF_SIZE/2)-128 || r_len > (AHMS_BUF_SIZE/2)-128) break;
        
        raw_idx = g_PlayerState[id][PL_MAP][i];
        ArrayGetArray(d[M_ITEMS], raw_idx, item);
        
        new d_name[96];
        if(contain(item[I_NAME], "ML_") != -1) format(d_name, 95, "%L", id, item[I_NAME]);
        else copy(d_name, 95, item[I_NAME]);

        new key = (i - start) + 1;
        if(key == 10) key = 0;

        new prefix[4] = "\w";
        if(item[I_DISABLED]) prefix = "\d";
        else if(item[I_USE_COLOR]) {
            if(item[I_COLOR][0] > 180 && item[I_COLOR][1] < 100) prefix = "\r"; 
            else if(item[I_COLOR][0] > 180 && item[I_COLOR][1] > 180 && item[I_COLOR][2] < 100) prefix = "\y"; 
            else prefix = "\w";
        }
        
        static line[128];
        formatex(line, 127, "%d. %s%s^n", key, prefix, d_name);
        
        if((i - start) < split_point) 
            l_len += add(l_col[l_len], (AHMS_BUF_SIZE/2)-l_len, line);
        else 
            r_len += add(r_col[r_len], (AHMS_BUF_SIZE/2)-r_len, line);
    }

    copy(title_out, AHMS_TITLE_LEN-1, d[M_TITLE]);
    if(contain(title_out, "ML_") != -1) format(title_out, AHMS_TITLE_LEN-1, "%L", id, title_out);
    
    new rgb[3]; rgb = d[M_COLOR];
    _ApplyAnim(id, d[M_ANIM], rgb, title_out);

    new Float:x_base = (d[M_POS_X] == -1.0) ? 0.05 : d[M_POS_X];
    new Float:x_pos = x_base;
    
    if(d[M_TRANSITION] > 0.0) {
        new Float:elapsed = get_gametime() - g_PlayerState[id][PL_OPEN_TIME];
        if(elapsed < d[M_TRANSITION]) {
            new Float:alpha = elapsed / d[M_TRANSITION];
            x_pos = -0.1 + ((x_base + 0.1) * alpha);
        }
    }

    new Float:title_x = (d[M_POS_X] == -1.0) ? -1.0 : (x_pos + 0.15); 
    set_hudmessage(rgb[0], rgb[1], rgb[2], title_x, d[M_POS_Y] - 0.05, 0, 0.0, d[M_REFRESH]+0.1, 0.0, 0.0, 4);
    ShowSyncHudMsg(id, g_msgSync[0], "%s", title_out);

    set_hudmessage(255, 255, 255, (d[M_POS_X] == -1.0 ? 0.20 : x_pos), d[M_POS_Y], 0, 0.0, d[M_REFRESH]+0.1, 0.0, 0.0, 3);
    ShowSyncHudMsg(id, g_msgSync[1], "%s", l_col);
    
    set_hudmessage(255, 255, 255, (d[M_POS_X] == -1.0 ? 0.55 : x_pos + 0.35), d[M_POS_Y], 0, 0.0, d[M_REFRESH]+0.1, 0.0, 0.0, 2);
    ShowSyncHudMsg(id, g_msgSync[2], "%s", r_col);

    _DrawFooter(id, d, page, max_page, (total > pp));
}

_DrawFooter(id, d[MenuDef], page, max, bool:paged) {
    static t_back[32], t_exit[32], t_next[32], foot[128];
    copy(t_back, 31, d[M_TXT_BACK]);
    copy(t_exit, 31, d[M_TXT_EXIT]);
    copy(t_next, 31, d[M_TXT_NEXT]);

    if(contain(t_back, "ML_")!=-1) format(t_back,31,"%L",id,t_back);
    if(contain(t_exit, "ML_")!=-1) format(t_exit,31,"%L",id,t_exit);
    if(contain(t_next, "ML_")!=-1) format(t_next,31,"%L",id,t_next);
    
    if(paged) {
        new left[64], right[64];
        if(page > 0) formatex(left, 63, "0. %s", t_back);
        else formatex(left, 63, "0. %s", (d[M_PARENT]!=-1)?t_back:t_exit);
        
        if(page < max) formatex(right, 63, "9. %s", t_next);
        else copy(right, 63, "");
        
        formatex(foot, 127, "%s                              %s", left, right);
    } else {
        formatex(foot, 127, "0. %s", (d[M_PARENT]!=-1)?t_back:t_exit);
    }
    
    set_hudmessage(200, 200, 200, -1.0, d[M_POS_Y] + 0.35, 0, 0.0, d[M_REFRESH]+0.1, 0.0, 0.0, 1);
    ShowSyncHudMsg(id, g_msgSync[3], "%s", foot);
}

_ApplyAnim(id, AHMS_AnimType:type, rgb[3], txt[AHMS_TITLE_LEN]) {
    if(type == ANIM_NONE) return;
    
    new Float:t = get_gametime();
    new Float:start = g_PlayerState[id][PL_OPEN_TIME];
    
    if(type == ANIM_PULSE) {
        new Float:m = (floatsin(t * AHMS_ANIM_SPEED, radian) + 1.0) * 0.5; 
        m = 0.5 + (m * 0.5); 
        rgb[0] = floatround(rgb[0]*m); rgb[1] = floatround(rgb[1]*m); rgb[2] = floatround(rgb[2]*m);
    }
    else if(type == ANIM_SHIMMER) {
        rgb[0] = floatround(127.0 + 127.0 * floatsin(t * 3.0, radian));
        rgb[1] = floatround(127.0 + 127.0 * floatsin(t * 3.0 + 2.0, radian));
        rgb[2] = floatround(127.0 + 127.0 * floatsin(t * 3.0 + 4.0, radian));
    }
    else if(type == ANIM_TYPEWRITER) {
        new len = strlen(txt);
        new Float:dt = t - start;
        new show_len = floatround(dt * (AHMS_ANIM_SPEED * 3.0)); 
        
        if(show_len < len) {
            txt[show_len] = '_'; 
            txt[show_len+1] = '^0';
        }
    }
}

/* ==========================================================================
   6. CACHE & LOGIC PIPELINE
   ========================================================================== */

_AHMS_BuildCache(id, mid, d[MenuDef]) {
    new Array:items = d[M_ITEMS];
    new total = ArraySize(items);
    new mapped = 0;
    new item[ItemDef];
    new flags = get_user_flags(id);
    
    new bool:search = g_PlayerState[id][PL_FILTER_ACTIVE];
    static s_buf[32]; 
    if(search) copy(s_buf, 31, g_PlayerState[id][PL_FILTER_TEXT]);

    for(new i=0; i<total; i++) {
        if(mapped >= AHMS_MAX_ITEMS) break;

        ArrayGetArray(items, i, item);
        
        if(item[I_ACCESS] && !(flags & item[I_ACCESS])) continue;
        
        if(search && containi(item[I_NAME], s_buf) == -1) continue;
        
        if(d[M_CB_CONDITION] != -1) {
            if(callfunc_begin_i(d[M_CB_CONDITION], -1) == 1) {
                callfunc_push_int(id);
                callfunc_push_int(mid);
                callfunc_push_int(i);
                callfunc_push_int(item[I_USER_DATA]);
                if(callfunc_end() == AHMS_SKIP_ITEM) continue;
            }
        }

        g_PlayerState[id][PL_MAP][mapped++] = i;
    }
    
    g_PlayerState[id][PL_TOTAL_CACHED] = mapped;
    g_PlayerState[id][PL_DIRTY_CACHE] = false;
}

public _AHMS_Input(id) {
    if(!is_user_connected(id) || !g_PlayerState[id][PL_IS_OPEN]) return PLUGIN_CONTINUE;
    
    if(get_gametime() - g_PlayerState[id][PL_LAST_ACT] < AHMS_DEFAULT_THROTTLE) return PLUGIN_HANDLED;
    
    new cmd[8]; read_argv(0, cmd, 7);
    new key = cmd[4] - '0'; 
    
    new mid = g_PlayerState[id][PL_MENU_ID];
    if(!_Valid(mid)) { AHMS_Close(id); return PLUGIN_HANDLED; }

    new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
    new total = g_PlayerState[id][PL_TOTAL_CACHED];
    new pp = d[M_ITEMS_PER_PAGE];
    new page = g_PlayerState[id][PL_PAGE];
    new bool:paged = (total > pp);

    g_PlayerState[id][PL_LAST_ACT] = get_gametime();

    if(paged) {
        if(key == 9) { 
            if((page+1)*pp < total) {
                g_PlayerState[id][PL_PAGE]++;
                client_cmd(id, "spk %s", SND_NEXT);
                _AHMS_Draw(id, mid);
            } else client_cmd(id, "spk %s", SND_ERR);
            return PLUGIN_HANDLED;
        }
        if(key == 0) { 
            if(page > 0) {
                g_PlayerState[id][PL_PAGE]--;
                client_cmd(id, "spk %s", SND_BACK);
                _AHMS_Draw(id, mid);
            } else _DoExit(id, d);
            return PLUGIN_HANDLED;
        }
    } else if(key == 0) {
        _DoExit(id, d);
        return PLUGIN_HANDLED;
    }

    new sel_v = -1;
    if (key > 0) sel_v = (page*pp) + (key - 1);
    
    if (sel_v >= 0 && sel_v < total) {
        new raw_idx = g_PlayerState[id][PL_MAP][sel_v];
        _DoSelect(id, mid, d, raw_idx);
    }
    
    return PLUGIN_HANDLED;
}

_DoExit(id, d[MenuDef]) {
    if(d[M_PARENT] != AHMS_NULL_INDEX) AHMS_Open(id, d[M_PARENT]);
    else {
        client_cmd(id, "spk %s", SND_BACK);
        AHMS_Close(id);
    }
}

_DoSelect(id, mid, d[MenuDef], raw) {
    new item[ItemDef]; ArrayGetArray(d[M_ITEMS], raw, item);
    
    if (item[I_DISABLED]) {
        client_cmd(id, "spk %s", SND_ERR);
        return;
    }

    client_cmd(id, "spk %s", SND_SEL);
    
    if (d[M_CB_SELECT] != -1) {
        if(callfunc_begin_i(d[M_CB_SELECT], -1)==1) {
            callfunc_push_int(id);
            callfunc_push_int(mid);
            callfunc_push_int(raw);
            callfunc_push_int(item[I_USER_DATA]);
            callfunc_end();
        }
    }
}

/* ==========================================================================
   7. SYSTEM LOOP (Managed Tasks)
   ========================================================================== */

_AHMS_ToggleState(id, bool:active) {
    if(g_PlayerState[id][PL_IS_OPEN] == active) return;
    
    g_PlayerState[id][PL_IS_OPEN] = active;
    if(active) {
        g_ActiveMenus++;
        if(g_ActiveMenus == 1) set_task(0.1, "_AHMS_Loop", AHMS_GLOBAL_TASK, _, _, "b");
    } else {
        g_ActiveMenus--;
        if(g_ActiveMenus <= 0) {
            g_ActiveMenus = 0;
            if(task_exists(AHMS_GLOBAL_TASK)) remove_task(AHMS_GLOBAL_TASK);
        }
    }
}

public _AHMS_Loop() {
    new Float:now = get_gametime();
    for(new id=1; id<=32; id++) {
        if(!g_PlayerState[id][PL_IS_OPEN]) continue;
        
        if(!is_user_connected(id)) { 
            g_PlayerState[id][PL_IS_OPEN] = false; 
            continue; 
        }
        
        if(now >= g_PlayerState[id][PL_NEXT_RENDER]) {
            new mid = g_PlayerState[id][PL_MENU_ID];
            if(!_Valid(mid)) { AHMS_Close(id); continue; }
            
            _AHMS_Draw(id, mid);
            
            new d[MenuDef]; ArrayGetArray(g_Menus, mid, d);
            g_PlayerState[id][PL_NEXT_RENDER] = now + d[M_REFRESH];
        }
    }
}

bool:_Valid(i) {
    if (!g_Init || g_Menus == Invalid_Array) return false;
    if (i < 0 || i >= ArraySize(g_Menus)) return false;
    new d[MenuDef]; ArrayGetArray(g_Menus, i, d);
    return d[M_IS_VALID];
}

public client_disconnected(id) {
    if(g_Init) {
        g_PlayerState[id][PL_IS_OPEN] = false;
        for(new i=0; i<AHMS_SYNC_POOL_SIZE; i++) ClearSyncHud(id, g_msgSync[i]);
    }
}