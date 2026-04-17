$bytes = [System.IO.File]::ReadAllBytes("c:\POS\icon.ico")
Write-Host "Size: $($bytes.Length) bytes"
Write-Host "First 6 bytes: $($bytes[0]) $($bytes[1]) $($bytes[2]) $($bytes[3]) $($bytes[4]) $($bytes[5])"
$type = [BitConverter]::ToUInt16($bytes, 2)
$count = [BitConverter]::ToUInt16($bytes, 4)
Write-Host "Type: $type (1=ICO, 2=CUR)"
Write-Host "Image count: $count"
for ($i = 0; $i -lt [Math]::Min($count, 8); $i++) {
    $offset = 6 + ($i * 16)
    $w = $bytes[$offset]; if ($w -eq 0) { $w = 256 }
    $h = $bytes[$offset+1]; if ($h -eq 0) { $h = 256 }
    $bpp = [BitConverter]::ToUInt16($bytes, $offset+6)
    $size = [BitConverter]::ToUInt32($bytes, $offset+8)
    Write-Host "  Image ${i}: ${w}x${h}, ${bpp}bpp, ${size} bytes"
}
