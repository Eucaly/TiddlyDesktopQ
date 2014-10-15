#SingleInstance,Force
SetBatchLines, -1
SetTitleMatchMode, 2
DetectHiddenWindows, On 

#include ProcessInfo.ahk

;if (!%1%)
;	exitApp
p = %1%
;	msgbox, [8] %0% `n [%1%] `n [%p%]
p0 =
Loop,10
{
;	msgbox, [%p%]
	if (po=p) break
	if (!p) break
	p0 := p
	WinActivate, ahk_pid %p% 
	ifWinExist, ahk_pid %p%
		break
	p := GetParentProcessID(p)
}