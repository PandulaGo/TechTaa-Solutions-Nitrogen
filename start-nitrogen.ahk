#Requires AutoHotkey v2.0
#SingleInstance Force
SetWorkingDir(A_ScriptDir)

BackendUrl  := "http://127.0.0.1:10061"
FrontendUrl := "http://127.0.0.1:10065"

IsRunning() {
    try {
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        whr.Open("GET", BackendUrl "/", false)
        whr.Send()
        return whr.Status = 200
    }
    return false
}

if (IsRunning()) {
    MsgBox("Nitrogen App is already running.", "Nitrogen App", 64)
} else {
    if (!FileExist("src\web\dist\index.html")) {
        RunWait('npm.cmd run build:web', A_ScriptDir, "Hide")
    }
    Run('node scripts/start.mjs', A_ScriptDir, "Hide", &pid)

    deadline := A_TickCount + 30000
    loop {
        if (IsRunning())
            break
        if (A_TickCount > deadline) {
            MsgBox("Timed out waiting for the service. Check logs\backend.log", "Nitrogen App", 16)
            ExitApp()
        }
        Sleep(1000)
    }
    MsgBox("Nitrogen App started.`n`nBackend:  " BackendUrl "`nFrontend: " FrontendUrl, "Nitrogen App", 64)
}

Run(FrontendUrl)
ExitApp()
