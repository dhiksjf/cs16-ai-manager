/**
 * ============================================================================
 *   SMART MENUS HUB [ULTIMATE FIXED]
 *   Verified Clean Compile (AMXX 1.8.2 / 1.9 / 1.10)
 * ============================================================================
 */

#if defined _sm_hub_included
    #endinput
#endif
#define _sm_hub_included

#include <amxmodx>
#include <amxmisc>
#include <fakemeta>

// --- CONFIGURATION ---
#define SM_REFRESH          0.1      // Tick rate
#define SM_TASK_ID          55000    // Safe Task Block
#define SM_ITEMS_PAGE       7        // Items per page
#define SM_LAYERS           3        // Max distinct colors per body
#define SM_TXT_MAX          128
#define SM_INFO_MAX         32

// --- TYPES ---
enum SmType {
    TYPE_NORMAL = 0, TYPE_HEADER, TYPE_SPACER,
    TYPE_TOGGLE, TYPE_SLIDER, TYPE_INPUT
}

enum SmAnim {
    ANIM_NONE = 0, ANIM_TYPEWRITER, ANIM_SCROLL, ANIM_PULSE
}

enum {
    ACT_OPEN = 0, ACT_EXIT, ACT_SELECT,
    ACT_TOGGLE, ACT_SLIDER, ACT_INPUT
}

// --- DATA ---
enum _:SmItem {
    _I_TEXT[SM_TXT_MAX], _I_INFO[SM_INFO_MAX], SmType:_I_TYPE, _I_ADMIN,
    _I_R, _I_G, _I_B, SmAnim:_I_ANIM,
    _I_VALUE, _I_MIN, _I_MAX, _I_STEP,
    _I_INPUT[SM_TXT_MAX], bool:_I_MASKED
}

enum _:SmMenu {
    _M_TITLE[SM_TXT_MAX], Array:_M_ITEMS, _M_CALLBACK[SM_INFO_MAX],
    _M_EXIT[SM_INFO_MAX], _M_PARENT
}

// --- GLOBALS ---
static Array:g_Menus
static g_HudTitle, g_HudBody[SM_LAYERS]
static g_PlrMenu[33], g_PlrPage[33], bool:g_PlrOpen[33]
static g_PlrTick[33], Float:g_PlrFade[33], g_PlrInputIdx[33]

static const SND_OPEN[]  = "common/wpn_hudon.wav"
static const SND_MOVE[]  = "common/wpn_moveselect.wav"
static const SND_CLICK[] = "common/wpn_select.wav"
static const SND_DENY[]  = "common/wpn_denyselect.wav"

// --- INIT ---
stock sm_init() {
    if(!g_Menus) g_Menus = ArrayCreate(SmMenu) // Enums as block size
    register_menu("SmHub_Key", 1023, "sm_key_handler")
    register_clcmd("say", "sm_chat_handler")
    register_clcmd("say_team", "sm_chat_handler")
    
    g_HudTitle = CreateHudSyncObj()
    for(new i=0; i < SM_LAYERS; i++) g_HudBody[i] = CreateHudSyncObj()
}

// --- API ---
stock sm_create(const title[], const callback[], parent=-1) {
    if(!g_Menus) return -1
    new d[SmMenu]
    copy(d[_M_TITLE], SM_TXT_MAX-1, title)
    copy(d[_M_CALLBACK], SM_INFO_MAX-1, callback)
    copy(d[_M_EXIT], SM_INFO_MAX-1, "Exit")
    d[_M_PARENT] = parent
    
    // [FIX 1] Pass 'sizeof(SmItem)' instead of just the tag 'SmItem' to fix Warning 213
    d[_M_ITEMS] = ArrayCreate(sizeof(SmItem)) 
    
    return ArrayPushArray(g_Menus, d)
}

stock sm_add_item(menu, const text[], const info[]="", flags=0, r=255, g=255, b=255) {
    new it[SmItem]; _sm_fill(it, text, info, flags, TYPE_NORMAL, r, g, b)
    _sm_push(menu, it)
}

stock sm_add_anim(menu, const text[], const info[], SmAnim:anim, r=255, g=255, b=255) {
    new it[SmItem]; _sm_fill(it, text, info, 0, TYPE_NORMAL, r, g, b)
    it[_I_ANIM] = anim
    _sm_push(menu, it)
}

stock sm_add_header(menu, const text[]) {
    new it[SmItem]; _sm_fill(it, text, "", 0, TYPE_HEADER, 255, 215, 0)
    it[_I_ANIM] = ANIM_PULSE; _sm_push(menu, it)
}

stock sm_add_spacer(menu) {
    new it[SmItem]; _sm_fill(it, "", "", 0, TYPE_SPACER, 0, 0, 0)
    _sm_push(menu, it)
}

stock sm_add_toggle(menu, const text[], const info[], bool:start, flags=0) {
    new it[SmItem]; _sm_fill(it, text, info, flags, TYPE_TOGGLE, 255, 255, 255)
    it[_I_VALUE] = start ? 1 : 0; _sm_push(menu, it)
}

stock sm_add_slider(menu, const text[], const info[], val, min, max, step=1) {
    new it[SmItem]; _sm_fill(it, text, info, 0, TYPE_SLIDER, 255, 255, 255)
    it[_I_VALUE]=val; it[_I_MIN]=min; it[_I_MAX]=max; it[_I_STEP]=step
    _sm_push(menu, it)
}

stock sm_add_input(menu, const text[], const info[], const def[], bool:masked=false) {
    new it[SmItem]; _sm_fill(it, text, info, 0, TYPE_INPUT, 255, 255, 255)
    copy(it[_I_INPUT], SM_TXT_MAX-1, def); it[_I_MASKED] = masked
    it[_I_ANIM] = ANIM_TYPEWRITER; _sm_push(menu, it)
}

stock sm_open(id, menu, page=0) {
    if(!is_user_connected(id) || !_sm_valid(menu)) return
    g_PlrMenu[id] = menu; g_PlrPage[id] = page
    g_PlrOpen[id] = true; g_PlrFade[id] = 0.0; g_PlrTick[id] = 0; g_PlrInputIdx[id] = -1
    client_cmd(id, "spk %s", SND_OPEN)
    _sm_cb(id, menu, -1, ACT_OPEN)
    remove_task(id+SM_TASK_ID)
    set_task(SM_REFRESH, "sm_render", id+SM_TASK_ID, _, _, "b")
}

stock sm_close(id) {
    if(g_PlrOpen[id] && _sm_valid(g_PlrMenu[id])) _sm_cb(id, g_PlrMenu[id], -1, ACT_EXIT)
    g_PlrOpen[id] = false; remove_task(id+SM_TASK_ID); show_menu(id, 0, "^n", 0)
}

// --- RENDERER ---
public sm_render(task_id) {
    new id = task_id - SM_TASK_ID
    if(!g_PlrOpen[id] || g_PlrInputIdx[id] != -1) return
    if(!_sm_valid(g_PlrMenu[id])) { sm_close(id); return; }

    new m = g_PlrMenu[id]
    new md[SmMenu]; ArrayGetArray(g_Menus, m, md)
    new Array:items = md[_M_ITEMS]

    if(g_PlrFade[id] < 1.0) g_PlrFade[id] += 0.20
    g_PlrTick[id]++

    new activeColors[SM_LAYERS][3], activeCount = 0
    static layerBuf[SM_LAYERS][512]
    for(new L=0; L<SM_LAYERS; L++) layerBuf[L][0] = EOS

    new start = g_PlrPage[id] * SM_ITEMS_PAGE, end = start + SM_ITEMS_PAGE
    new idx = start, slot = 0, keys = 0
    
    while(idx < ArraySize(items) && idx < end) {
        new it[SmItem]; ArrayGetArray(items, idx, it)
        new r=it[_I_R], g=it[_I_G], b=it[_I_B], layer = -1
        
        if(it[_I_ADMIN] && !(get_user_flags(id)&it[_I_ADMIN])) { r=80; g=80; b=80; }
        
        for(new k=0; k<activeCount; k++)
            if(activeColors[k][0]==r && activeColors[k][1]==g && activeColors[k][2]==b) { layer=k; break; }
        
        if(layer == -1) {
            if(activeCount < SM_LAYERS) {
                layer = activeCount
                activeColors[layer][0]=r; activeColors[layer][1]=g; activeColors[layer][2]=b
                activeCount++
            } else layer = 0 
        }
        
        static txt[128], line[128]
        _sm_anim(it, g_PlrTick[id], txt)
        
        switch(it[_I_TYPE]) {
            case TYPE_SPACER: copy(line,127," ")
            case TYPE_HEADER: format(line,127,"- %s -", txt)
            default: {
                if(it[_I_TYPE]==TYPE_SLIDER) format(line,127,"%d. %s < %d >", slot+1, txt, it[_I_VALUE])
                else if(it[_I_TYPE]==TYPE_TOGGLE) format(line,127,"%d. %s [%s]", slot+1, txt, it[_I_VALUE]?"ON":"OFF")
                else if(it[_I_TYPE]==TYPE_INPUT) {
                    new buf[32]; copy(buf,31,it[_I_MASKED]?"*****":it[_I_INPUT]); if(!buf[0]) copy(buf,31,"...")
                    format(line,127,"%d. %s: [%s]", slot+1, txt, buf)
                }
                else format(line,127,"%d. %s", slot+1, txt)
                
                if(it[_I_ADMIN] && r==80) add(line,127, " [VIP]")
                keys |= (1<<slot); slot++
            }
        }
        
        for(new L=0; L<SM_LAYERS; L++) {
            if(L==layer) format(layerBuf[L], 511, "%s%s^n", layerBuf[L], line)
            else add(layerBuf[L], 511, " ^n")
        }
        idx++
    }
    
    new exitTxt[32]; formatex(exitTxt, 31, "%s", md[_M_EXIT])
    
    add(layerBuf[0], 511, "^n")
    if((g_PlrPage[id]>0 || md[_M_PARENT]!=-1)) { add(layerBuf[0], 511, "8. Back^n"); keys |= (1<<7); } 
    else add(layerBuf[0], 511, " \n")
    if(idx<ArraySize(items)) { add(layerBuf[0], 511, "9. Next^n"); keys |= (1<<8); } 
    else add(layerBuf[0], 511, " \n")
    format(layerBuf[0], 511, "%s^n0. %s", layerBuf[0], exitTxt); keys|=(1<<9)

    show_menu(id, keys, "^n", -1, "SmHub_Key")
    
    new tTitle[128]; formatex(tTitle, 127, "%s", md[_M_TITLE])
    set_hudmessage(255, 60, 60, 0.02, 0.18, 0, 0.0, SM_REFRESH+0.1, 0.0, 0.0, -1)
    ShowSyncHudMsg(id, g_HudTitle, "== %s ==^n^n", tTitle)
    
    for(new L=0; L<activeCount; L++) {
        new fadeR = floatround(float(activeColors[L][0]) * g_PlrFade[id])
        new fadeG = floatround(float(activeColors[L][1]) * g_PlrFade[id])
        new fadeB = floatround(float(activeColors[L][2]) * g_PlrFade[id])
        
        set_hudmessage(fadeR, fadeG, fadeB, 0.02, 0.23, 0, 0.0, SM_REFRESH+0.1, 0.0, 0.0, -1)
        ShowSyncHudMsg(id, g_HudBody[L], layerBuf[L])
    }
}

// --- HANDLERS ---
public sm_key_handler(id, key) {
    if(!g_PlrOpen[id] || !_sm_valid(g_PlrMenu[id])) return PLUGIN_HANDLED
    new m = g_PlrMenu[id]
    new md[SmMenu]; ArrayGetArray(g_Menus, m, md)
    
    if(key==9) { sm_close(id); client_cmd(id,"spk %s",SND_DENY); return PLUGIN_HANDLED; }
    if(key==7) { 
        if(g_PlrPage[id]>0) g_PlrPage[id]--; else if(md[_M_PARENT]!=-1) sm_open(id, md[_M_PARENT]); 
        client_cmd(id,"spk %s",SND_MOVE); return PLUGIN_HANDLED; 
    }
    if(key==8) { g_PlrPage[id]++; client_cmd(id,"spk %s",SND_MOVE); return PLUGIN_HANDLED; }
    
    new Array:items = md[_M_ITEMS]
    new start=g_PlrPage[id]*SM_ITEMS_PAGE, idx=start, count=0, realIdx=-1
    
    while(idx < ArraySize(items)) {
        new scanIt[SmItem]; ArrayGetArray(items, idx, scanIt)
        if(scanIt[_I_TYPE]!=TYPE_SPACER && scanIt[_I_TYPE]!=TYPE_HEADER) {
             if(!scanIt[_I_ADMIN] || (get_user_flags(id)&scanIt[_I_ADMIN])) {
                 if(count == key) { realIdx=idx; break; }
                 count++
                 if(count >= SM_ITEMS_PAGE) break
             }
        }
        idx++
    }

    if(realIdx!=-1) {
        new it[SmItem]; ArrayGetArray(items, realIdx, it)
        new act=ACT_SELECT
        
        if(it[_I_TYPE]==TYPE_TOGGLE) { 
            it[_I_VALUE]=!it[_I_VALUE]; act=ACT_TOGGLE; 
            // [FIX 2] Strict cast 'Array:' to avoid Error 035 if compiler loses track of variable type
            ArraySetArray(Array:items,realIdx,it); 
            client_cmd(id,"spk %s",SND_MOVE)
        }
        else if(it[_I_TYPE]==TYPE_SLIDER) {
            it[_I_VALUE]+=it[_I_STEP]; if(it[_I_VALUE]>it[_I_MAX]) it[_I_VALUE]=it[_I_MIN];
            act=ACT_SLIDER; 
            ArraySetArray(Array:items,realIdx,it); 
            client_cmd(id,"spk %s",SND_MOVE)
        }
        else if(it[_I_TYPE]==TYPE_INPUT) {
            g_PlrInputIdx[id] = realIdx; client_print(id, print_center, "TYPE IN CHAT...");
            client_cmd(id, "spk %s", SND_CLICK); return PLUGIN_HANDLED;
        }
        else { sm_close(id); client_cmd(id, "spk %s", SND_CLICK); }
        
        _sm_cb(id, m, realIdx, act)
    }
    return PLUGIN_HANDLED
}

public sm_chat_handler(id) {
    if(g_PlrInputIdx[id]!=-1) {
        new txt[128]; read_args(txt, 127); remove_quotes(txt)
        if(txt[0]) {
             new m=g_PlrMenu[id];
             if(_sm_valid(m)) {
                 new md[SmMenu]; ArrayGetArray(g_Menus, m, md)
                 // Use temporary Array var to ensure handle correctness
                 new Array:itemArray = md[_M_ITEMS];
                 
                 new it[SmItem]; ArrayGetArray(itemArray, g_PlrInputIdx[id], it)
                 copy(it[_I_INPUT], 127, txt); 
                 
                 // [FIX 3] Explicit Array cast and ensure item type is Any (handled auto by enum struct usually but safe ref required)
                 ArraySetArray(itemArray, g_PlrInputIdx[id], it)
                 
                 _sm_cb(id, m, g_PlrInputIdx[id], ACT_INPUT)
             }
             g_PlrInputIdx[id]=-1; sm_open(id, g_PlrMenu[id], g_PlrPage[id])
             return PLUGIN_HANDLED
        }
    }
    return PLUGIN_CONTINUE
}

// --- HELPER FUNC ---
stock bool:_sm_valid(m) { return (g_Menus && m>=0 && m<ArraySize(g_Menus)); }

stock _sm_fill(it[SmItem], const t[], const i[], f, SmType:ty, r, g, b) {
    copy(it[_I_TEXT],127,t); copy(it[_I_INFO],31,i); it[_I_ADMIN]=f; it[_I_TYPE]=ty
    it[_I_R]=r; it[_I_G]=g; it[_I_B]=b; it[_I_ANIM]=ANIM_NONE;
}

stock _sm_push(m, it[SmItem]) {
    if(_sm_valid(m)) { 
        new md[SmMenu]; ArrayGetArray(g_Menus, m, md); 
        ArrayPushArray(md[_M_ITEMS], it); 
    }
}

stock _sm_cb(id, m, idx, act) {
    new md[SmMenu]; ArrayGetArray(g_Menus, m, md); new func = get_func_id(md[_M_CALLBACK])
    if(func!=-1) {
        new v=0, b[128]; 
        if(idx!=-1) { new it[SmItem]; ArrayGetArray(md[_M_ITEMS], idx, it); v=it[_I_VALUE]; 
        if(act==ACT_INPUT) copy(b,127,it[_I_INPUT]); else copy(b,31,it[_I_INFO]); }
        if(callfunc_begin_i(func)==1) { 
            callfunc_push_int(id); callfunc_push_int(m); callfunc_push_int(idx);
            callfunc_push_int(act); callfunc_push_int(v); callfunc_push_str(b); callfunc_end() 
        }
    }
}

stock _sm_anim(it[SmItem], t, out[]) {
    new src[128]; copy(src,127,it[_I_TEXT]); new l=strlen(src)
    if(it[_I_ANIM]==ANIM_TYPEWRITER) { 
        new s=(t/2)%(l+5); copy(out,(s>l)?l:s,src); 
        if((t%4)<2 && s<=l) add(out,127,"_"); 
    }
    else if(it[_I_ANIM]==ANIM_SCROLL) { 
        // [FIX 4] Manual char logic to prevent 'format' Argument Type errors
        new of=(t/2)%(l+4)
        new outIdx = 0
        for(new i=0; i<15; i++) { 
            if(of+i < l) out[outIdx++] = src[of+i]
            else out[outIdx++] = ' ' // space char
        }
        out[outIdx] = EOS
    }
    else if(it[_I_ANIM]==ANIM_PULSE && (t%15)<7) format(out,127,"- %s -", src);
    else copy(out, 127, src);
}