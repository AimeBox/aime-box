!macro customInstall
  SetOutPath "$TEMP"
  File /oname=vc_redist.x64.exe "${resources}\vc_redist.x64.exe"

  ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
!macroend