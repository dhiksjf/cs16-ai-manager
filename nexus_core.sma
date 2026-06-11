#include <amxmodx>
#include <amxmisc>
#include <nvault>
#include <easy_http>
#include <easy_http_json>

#define API_URL "https://unusual-rafaela-cs-server-embed-generator-879fda74.koyeb.app/api/nexus"
#define POLL_INTERVAL 1.5

new g_Vault
new g_MyID[16], g_TargetID[16], g_ServerTag[32]
new g_Mode
new g_LastMsgId = 0

public plugin_init() {
    register_plugin("Nexus Core: Raw Chat", "5.2-Final", "Yassine")

    register_clcmd("say /crosschat", "Cmd_OpenMenu", ADMIN_RCON)
    register_clcmd("say", "Cmd_HookSay")
    register_clcmd("say_team", "Cmd_HookSay")

    register_clcmd("cc_input_target", "Input_TargetID")
    register_clcmd("cc_input_tag", "Input_ServerTag")

    set_task(1.0, "System_Init")
}

public System_Init() {
    g_Vault = nvault_open("nexus_network_data")
    Load_Settings()

    if(g_MyID[0] == EOS) {
        Generate_Random_ID(g_MyID, 5)
        g_Mode = 0
        Save_Settings()
    }

    set_task(POLL_INTERVAL, "Task_PollMessages", _, _, _, "b")
}

public Cmd_HookSay(id) {
    if(!is_user_connected(id) || is_user_bot(id)) return PLUGIN_CONTINUE
    if(g_Mode == 0 || g_Mode == 3 || g_TargetID[0] == EOS) return PLUGIN_CONTINUE

    new szArgs[192]
    read_args(szArgs, charsmax(szArgs))
    remove_quotes(szArgs)
    trim(szArgs)

    if(szArgs[0] == EOS || szArgs[0] == '/' || szArgs[0] == '!') return PLUGIN_CONTINUE

    new szName[32]
    get_user_name(id, szName, charsmax(szName))

    new szEndpoint[256]
    formatex(szEndpoint, charsmax(szEndpoint), "%s/push", API_URL)

    new EzJSON:payload = ezjson_init_object()
    ezjson_object_set_string(payload, "target_id", g_TargetID)
    ezjson_object_set_string(payload, "sender", szName)
    ezjson_object_set_string(payload, "message", szArgs)
    ezjson_object_set_string(payload, "tag", g_ServerTag)

    new EzHttpOptions:opts = ezhttp_create_options()
    ezhttp_option_set_header(opts, "Content-Type", "application/json")
    ezhttp_option_set_body_from_json(opts, payload)

    ezhttp_post(szEndpoint, "OnPushComplete", opts)
    ezjson_free(payload)

    return PLUGIN_CONTINUE
}

public OnPushComplete(EzHttpRequest:request_id) {}

public Task_PollMessages() {
    if(g_Mode == 0 || g_Mode == 2 || g_MyID[0] == EOS) return

    new szEndpoint[256]
    formatex(szEndpoint, charsmax(szEndpoint), "%s/poll?my_id=%s&last_id=%d", API_URL, g_MyID, g_LastMsgId)
    ezhttp_get(szEndpoint, "OnPollComplete")
}

public OnPollComplete(EzHttpRequest:request_id) {
    if(ezhttp_get_error_code(request_id) != EZH_OK) return

    new EzJSON:res = ezhttp_parse_json_response(request_id)
    if(res == EzJSON:EzInvalid_JSON) return

    if(ezjson_object_has_value(res, "last_id")) {
        g_LastMsgId = ezjson_object_get_number(res, "last_id")
    }

    new EzJSON:msgs = ezjson_object_get_value(res, "messages")
    if(ezjson_is_array(msgs)) {
        new size = ezjson_array_get_count(msgs)
        for(new i = 0; i < size; i++) {
            new EzJSON:msgObj = ezjson_array_get_value(msgs, i)
            if(msgObj == EzJSON:EzInvalid_JSON) continue

            new szTag[32], szSender[32], szText[192]
            ezjson_object_get_string(msgObj, "tag", szTag, charsmax(szTag))
            ezjson_object_get_string(msgObj, "sender", szSender, charsmax(szSender))
            ezjson_object_get_string(msgObj, "message", szText, charsmax(szText))

            client_print_color(0, print_team_default, "^4[%s]^3 %s^1 : %s", szTag, szSender, szText)
        }
    }
    ezjson_free(res)
}

public Cmd_OpenMenu(id) {
    if(!(get_user_flags(id) & ADMIN_RCON)) return PLUGIN_HANDLED

    new menu = menu_create("\yNexus Gateway \w| Config", "Menu_Handler")
    new szItem[128], szModeStr[32]

    if(g_Mode == 0) szModeStr = "\r[OFFLINE]"
    else if(g_Mode == 1) szModeStr = "\y[TWO-WAY CHAT]"
    else if(g_Mode == 2) szModeStr = "\d[SEND ONLY]"
    else szModeStr = "\d[RECEIVE ONLY]"

    formatex(szItem, charsmax(szItem), "State: %s", szModeStr)
    menu_additem(menu, szItem, "1")

    formatex(szItem, charsmax(szItem), "My ID: \y%s", g_MyID)
    menu_additem(menu, szItem, "2")

    formatex(szItem, charsmax(szItem), "Target ID: \y%s", g_TargetID[0] == EOS ? "\r[UNSET]" : g_TargetID)
    menu_additem(menu, szItem, "3")

    formatex(szItem, charsmax(szItem), "Tag: \y%s", g_ServerTag)
    menu_additem(menu, szItem, "4")

    menu_setprop(menu, MPROP_EXIT, MEXIT_ALL)
    menu_display(id, menu, 0)

    return PLUGIN_HANDLED
}

public Menu_Handler(id, menu, item) {
    if(item == MENU_EXIT) {
        menu_destroy(menu)
        return PLUGIN_HANDLED
    }

    new info[3], dummy
    menu_item_getinfo(menu, item, dummy, info, charsmax(info), _, _, dummy)
    new key = str_to_num(info)

    switch(key) {
        case 1: { g_Mode++; if(g_Mode > 3) g_Mode = 0; Save_Settings(); Cmd_OpenMenu(id); }
        case 2: { client_print_color(id, print_team_default, "^4[NEXUS]^1 ID: ^3%s", g_MyID); Cmd_OpenMenu(id); }
        case 3: { client_cmd(id, "messagemode cc_input_target"); }
        case 4: { client_cmd(id, "messagemode cc_input_tag"); }
    }
    menu_destroy(menu)
    return PLUGIN_HANDLED
}

public Input_TargetID(id) {
    new szArgs[16]; read_args(szArgs, charsmax(szArgs)); remove_quotes(szArgs); trim(szArgs);
    if(equali(szArgs, g_MyID)) return PLUGIN_HANDLED
    copy(g_TargetID, charsmax(g_TargetID), szArgs); Save_Settings(); Cmd_OpenMenu(id);
    return PLUGIN_HANDLED
}

public Input_ServerTag(id) {
    new szArgs[32]; read_args(szArgs, charsmax(szArgs)); remove_quotes(szArgs); trim(szArgs);
    copy(g_ServerTag, charsmax(g_ServerTag), szArgs); Save_Settings(); Cmd_OpenMenu(id);
    return PLUGIN_HANDLED
}

Load_Settings() {
    nvault_get(g_Vault, "my_id", g_MyID, charsmax(g_MyID))
    nvault_get(g_Vault, "target_id", g_TargetID, charsmax(g_TargetID))
    if(!nvault_get(g_Vault, "tag", g_ServerTag, charsmax(g_ServerTag))) copy(g_ServerTag, charsmax(g_ServerTag), "SERVER")
    g_Mode = nvault_get(g_Vault, "mode")
}

Save_Settings() {
    nvault_set(g_Vault, "my_id", g_MyID)
    nvault_set(g_Vault, "target_id", g_TargetID)
    nvault_set(g_Vault, "tag", g_ServerTag)
    new szNum[4]; num_to_str(g_Mode, szNum, charsmax(szNum)); nvault_set(g_Vault, "mode", szNum)
}

Generate_Random_ID(szOutput[], len) {
    new const chars[] = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"
    for(new i = 0; i < len; i++) szOutput[i] = chars[random(sizeof(chars)-1)]
    szOutput[len] = EOS
}
