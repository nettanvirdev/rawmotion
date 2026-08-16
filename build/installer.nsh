; ============================================================================
;  Custom NSIS installer script for Raw Motion
;  Loaded by electron-builder via  build.nsis.include
;
;  Adds:
;    * a branded Welcome page (assisted installer omits it by default)
;    * a custom "Additional Tasks" page (nsDialogs) with two options:
;        - Create a Desktop shortcut  (default: on)
;        - Launch at Windows sign-in  (default: off)
;    * install / uninstall logic that honours those choices
;
;  NOTE: this file is parsed in BOTH the installer and the uninstaller compile
;  passes. Installer-only pages/functions are guarded with !ifndef
;  BUILD_UNINSTALLER, otherwise their functions would be defined-but-unreferenced
;  in the uninstaller pass (NSIS emits a warning, which electron-builder treats
;  as a fatal error).
; ============================================================================

; Registry value used to launch the app when the user signs in to Windows.
!define STARTUP_REG_KEY "Software\Microsoft\Windows\CurrentVersion\Run"

!ifndef BUILD_UNINSTALLER

  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  ; State shared between the custom page and the install section.
  Var Dialog
  Var DesktopCheckbox
  Var StartupCheckbox
  Var CreateDesktopShortcutState
  Var LaunchAtStartupState

  ; -------------------------------------------------------------------------
  ;  Branded welcome page
  ; -------------------------------------------------------------------------
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
    !define MUI_WELCOMEPAGE_TEXT "This wizard will install ${PRODUCT_NAME} ${VERSION} on your computer.$\r$\n$\r$\nAI-generated motion graphics and product launch videos.$\r$\n$\r$\nClick Next to continue."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; -------------------------------------------------------------------------
  ;  Custom "Additional Tasks" page (shown right after the directory page)
  ; -------------------------------------------------------------------------
  !macro customPageAfterChangeDir
    Page custom AdditionalTasksPageCreate AdditionalTasksPageLeave
  !macroend

  Function AdditionalTasksPageCreate
    ; MUI_HEADER_TEXT is intentionally not used - this file is parsed before
    ; MUI2.nsh is loaded, so that macro is not yet defined. We draw an in-dialog
    ; title instead.
    nsDialogs::Create 1018
    Pop $Dialog
    ${If} $Dialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 12u "Additional Tasks"
    Pop $0

    ${NSD_CreateLabel} 0 14u 100% 20u "Select the additional tasks you would like Setup to perform while installing ${PRODUCT_NAME}, then click Next."
    Pop $0

    ${NSD_CreateCheckbox} 0 40u 100% 12u "Create a shortcut on the Desktop"
    Pop $DesktopCheckbox
    ${NSD_Check} $DesktopCheckbox

    ${NSD_CreateCheckbox} 0 58u 100% 12u "Launch ${PRODUCT_NAME} automatically when I sign in to Windows"
    Pop $StartupCheckbox

    nsDialogs::Show
  FunctionEnd

  Function AdditionalTasksPageLeave
    ${NSD_GetState} $DesktopCheckbox $CreateDesktopShortcutState
    ${NSD_GetState} $StartupCheckbox $LaunchAtStartupState
  FunctionEnd

  ; -------------------------------------------------------------------------
  ;  Apply the user's choices during installation
  ; -------------------------------------------------------------------------
  !macro customInstall
    ; NSD_GetState returns 1 when a checkbox is ticked, 0 otherwise.
    ${If} $CreateDesktopShortcutState == 1
      CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}

    ${If} $LaunchAtStartupState == 1
      WriteRegStr HKCU "${STARTUP_REG_KEY}" "${PRODUCT_NAME}" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
    ${EndIf}
  !macroend

!endif ; !BUILD_UNINSTALLER

; ---------------------------------------------------------------------------
;  Clean up on uninstall (runs in the uninstaller pass)
; ---------------------------------------------------------------------------
!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  DeleteRegValue HKCU "${STARTUP_REG_KEY}" "${PRODUCT_NAME}"
!macroend
