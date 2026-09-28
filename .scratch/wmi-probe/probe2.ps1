$ErrorActionPreference='Continue'
$ns='root/Microsoft/Windows/Storage'
Write-Host "`n[1] root\wmi:MSStorageDriver_ATAPISmartData (需解析二进制)" -ForegroundColor White
try { $x=@(Get-CimInstance -Namespace root/wmi -ClassName MSStorageDriver_ATAPISmartData -OperationTimeoutSec 4 -ErrorAction Stop); Write-Host "  -> $($x.Count) 实例 OK" -ForegroundColor Green } catch { Write-Host "  -> FAIL: $(($_.Exception.Message -split "`r?`n")[0])" -ForegroundColor Red }

Write-Host "`n[2] root\Microsoft\Windows\Storage:MSFT_PhysicalDisk 全属性" -ForegroundColor White
try { $d=Get-CimInstance -Namespace root/Microsoft/Windows/Storage -ClassName MSFT_PhysicalDisk -OperationTimeoutSec 4 -ErrorAction Stop
      foreach($p in $d.CimInstanceProperties){ if($p.Name -match 'Power|Hour|Wear|Health|Bus|Media|Size|Friendly'){ Write-Host ("  {0,-32} {1}" -f $p.Name,$p.Value) } } } catch { Write-Host "  -> FAIL: $(($_.Exception.Message -split "`r?`n")[0])" -ForegroundColor Red }

Write-Host "`n[3] Get-StorageReliabilityCounter 详细错误" -ForegroundColor White
try { Get-PhysicalDisk | ForEach-Object { Get-StorageReliabilityCounter -PhysicalDisk $_ -ErrorAction Stop | Select PowerOnHours,Wear,Temperature | Format-List } } catch { Write-Host "  -> $($_.Exception.GetType().FullName)" -ForegroundColor Red; Write-Host "  -> $($_.Exception.Message)" -ForegroundColor Red }

Write-Host "`n[4] 当前是否管理员 / 进程完整性" -ForegroundColor White
Write-Host "  Admin = $(([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
