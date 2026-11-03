# Generate delivery variants from the existing licensed repository originals.
# No network requests, dependencies, or changes to the source JPG files.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../back/content/media'))
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$registry = @()
foreach ($name in @('samarkand', 'bukhara', 'china')) {
    $sourcePath = Join-Path $assetDirectory ($name + '.jpg')
    $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        $widths = @(480, 960, 1280, 1600, 1920) | Where-Object { $_ -le $sourceImage.Width }
        foreach ($width in $widths) {
            $height = [int][Math]::Round($sourceImage.Height * $width / $sourceImage.Width)
            $bitmap = New-Object System.Drawing.Bitmap($width, $height)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
            try {
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($sourceImage, 0, 0, $width, $height)
                $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]84)
                $filename = "$name-$width.jpg"
                $destinationPath = Join-Path $assetDirectory $filename
                $bitmap.Save($destinationPath, $jpegCodec, $parameters)
                $registry += [pscustomobject][ordered]@{ file = $filename; source = "$name.jpg"; width = $width; height = $height; bytes = (Get-Item -LiteralPath $destinationPath).Length; sha256 = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant(); treatment = 'Proportional resize and JPEG quality 84; source author and license unchanged (credits.json).' }
            } finally { $graphics.Dispose(); $bitmap.Dispose(); $parameters.Dispose() }
        }
    } finally { $sourceImage.Dispose() }
}
[System.IO.File]::WriteAllText((Join-Path $assetDirectory 'image-variants.json'), ($registry | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
$registry | Select-Object file, width, height, bytes | Format-Table -AutoSize
