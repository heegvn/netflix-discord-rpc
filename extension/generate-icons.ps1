Add-Type -AssemblyName System.Drawing
$assetsDir = "$PSScriptRoot\assets"
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

function Create-Icon {
    param(
        [int]$size,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Fond noir
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 20, 20))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # N rouge Netflix
    $font = [System.Drawing.Font]::new("Arial", [float]($size * 0.6), [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(229, 9, 20))

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $g.DrawString("N", $font, $brush, $rect, $sf)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Create-Icon -size 16 -outputPath "$assetsDir\icon16.png"
Create-Icon -size 48 -outputPath "$assetsDir\icon48.png"
Create-Icon -size 128 -outputPath "$assetsDir\icon128.png"
Write-Output "Extension icons created in $assetsDir"
