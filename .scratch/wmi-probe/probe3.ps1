$ErrorActionPreference='Continue'
$out = New-Object System.Collections.Generic.List[string]
function Cap($t){ $out.Add(""); $out.Add("### $t") }
function IsVirtual($id){
  if (-not $id) { return $true }
  return $id.StartsWith('ROOT') -or $id.StartsWith('SWD') -or $id.StartsWith('SW\') -or $id.StartsWith('{') -or $id.StartsWith('BTH')
}

Cap "B 的判据实测：PNPDeviceID 以 ROOT / SWD / SW\ / { / BTH 开头的算虚拟"
foreach ($c in @('Win32_NetworkAdapter','Win32_VideoController','Win32_SoundDevice','Win32_DesktopMonitor','Win32_DiskDrive')) {
  $all  = @(Get-CimInstance $c -ErrorAction SilentlyContinue)
  $keep = @($all | Where-Object { -not (IsVirtual $_.PNPDeviceID) })
  $out.Add("[$c]  全部 $($all.Count)  ->  留下 $($keep.Count)")
  foreach ($d in $all) {
    $label = if ($d.Model) { "$($d.Model)" } else { "$($d.Name)" }
    $tag   = if (IsVirtual $d.PNPDeviceID) { 'drop' } else { 'KEEP' }
    $out.Add("    $tag  $label   <$($d.PNPDeviceID)>")
  }
}

Cap "只排除 ROOT / SWD / { 三项时，网卡剩什么（BTH 不排除）"
@(Get-CimInstance Win32_NetworkAdapter) | Where-Object {
  $_.PNPDeviceID -and -not ($_.PNPDeviceID.StartsWith('ROOT') -or $_.PNPDeviceID.StartsWith('SWD') -or $_.PNPDeviceID.StartsWith('{'))
} | ForEach-Object { $out.Add("    $($_.Name)  <$($_.PNPDeviceID)>") }

Cap "WMI 现成的判据：Win32_NetworkAdapter.PhysicalAdapter"
Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue | ForEach-Object {
  $p = if ($null -eq $_.PhysicalAdapter) { 'null' } else { $_.PhysicalAdapter }
  $out.Add("    PhysicalAdapter=$p  AdapterTypeID=$($_.AdapterTypeID)  NetEnabled=$($_.NetEnabled)  $($_.Name)")
}
$pa = @(Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter -eq $true })
$out.Add("    => PhysicalAdapter=true 合计 $($pa.Count) 块")
foreach ($p in $pa) { $out.Add("       $($p.Name)  NetConnectionID=$($p.NetConnectionID)") }

Cap "Win32_PnPEntity 作通用判据？"
$ent = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue)
$out.Add("    总数 = $($ent.Count)")
$ent | Where-Object { $_.PNPClass -in @('Display','Net','Media','DiskDrive','Monitor') } | ForEach-Object {
  $out.Add("    [$($_.PNPClass)] $($_.Name)   <$($_.PNPDeviceID)>")
}

$out | Set-Content -Encoding UTF8 .scratch/wmi-probe/RESULT3.txt
