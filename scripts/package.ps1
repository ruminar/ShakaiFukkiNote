[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputRoot = Join-Path $ProjectRoot 'dist'
[void][IO.Directory]::CreateDirectory($OutputRoot)
$Common = Get-Content -Raw (Join-Path $ProjectRoot 'manifests/common.json') | ConvertFrom-Json -AsHashtable
$Package = Get-Content -Raw (Join-Path $ProjectRoot 'package.json') | ConvertFrom-Json -AsHashtable
if ($Common.version -ne $Package.version -or $Common.manifest_version -ne 3) { throw 'バージョンまたはManifest形式が不正です。' }
if (($Common.permissions -join ',') -ne 'storage' -or $Common.action.ContainsKey('default_popup')) { throw '権限またはアクション定義が最小構成と一致しません。' }
$Files = @(
    'LICENSE', 'README.md',
    'src/api.js', 'src/background-chromium.js', 'src/background.js',
    'src/tag-url.js', 'src/content.js', 'src/content.css',
    'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'
)
$Reports = @()
foreach ($Target in @('chromium', 'firefox')) {
    $Manifest = Get-Content -Raw (Join-Path $ProjectRoot 'manifests/common.json') | ConvertFrom-Json -AsHashtable
    $Overlay = Get-Content -Raw (Join-Path $ProjectRoot "manifests/$Target.json") | ConvertFrom-Json -AsHashtable
    foreach ($Key in $Overlay.Keys) { $Manifest[$Key] = $Overlay[$Key] }
    if ($Target -eq 'chromium') {
        if ($Manifest.background.ContainsKey('scripts') -or $Manifest.background.service_worker -ne 'src/background-chromium.js') { throw 'Chrome用backgroundが不正です。' }
    } else {
        if ($Manifest.background.ContainsKey('service_worker') -or $Manifest.background.persistent -ne $false) { throw 'Firefox用backgroundが不正です。' }
        $Settings = $Manifest.browser_specific_settings
        if (!$Settings.gecko.id -or ($Settings.gecko.data_collection_permissions.required -join ',') -ne 'none' -or !$Settings.gecko_android.strict_min_version) { throw 'Firefox向け宣言が不足しています。' }
    }
    $TargetRoot = Join-Path $OutputRoot $Target
    [void][IO.Directory]::CreateDirectory($TargetRoot)
    $Allowed = @('manifest.json') + $Files
    # 既存生成物に未知のファイルがあれば混入させず停止する。再帰削除は行わない。
    foreach ($Existing in Get-ChildItem -LiteralPath $TargetRoot -File -Recurse) {
        $Relative = [IO.Path]::GetRelativePath($TargetRoot, $Existing.FullName).Replace('\', '/')
        if ($Relative -notin $Allowed) { throw "生成先に対象外ファイルがあります：$Relative" }
    }
    foreach ($File in $Files) {
        $Source = Join-Path $ProjectRoot $File
        if (!(Test-Path -LiteralPath $Source -PathType Leaf)) { throw "参照ファイルがありません：$File" }
        $Destination = Join-Path $TargetRoot $File
        [void][IO.Directory]::CreateDirectory((Split-Path -Parent $Destination))
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
    $Manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $TargetRoot 'manifest.json') -Encoding utf8NoBOM
    $References = @($Manifest.icons.Values) + @($Manifest.action.default_icon.Values)
    foreach ($Script in $Manifest.content_scripts) { $References += $Script.js; $References += $Script.css }
    if ($Manifest.background.ContainsKey('service_worker')) { $References += $Manifest.background.service_worker }
    else { $References += $Manifest.background.scripts }
    foreach ($Reference in $References) {
        if ($Reference -notin $Files -or !(Test-Path -LiteralPath (Join-Path $TargetRoot $Reference) -PathType Leaf)) { throw "Manifest参照が不正です：$Reference" }
    }
    $ZipPath = Join-Path $OutputRoot "ShakaiFukkiNote-$($Common.version)-$Target.zip"
    $ZipStream = [IO.File]::Open($ZipPath, [IO.FileMode]::Create)
    $Archive = [IO.Compression.ZipArchive]::new($ZipStream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($File in $Allowed) {
            $Entry = $Archive.CreateEntry($File, [IO.Compression.CompressionLevel]::Optimal)
            # 同一ソースなら同一ZIPになるようタイムスタンプを固定する。
            $Entry.LastWriteTime = [DateTimeOffset]::new(2026, 10, 30, 0, 0, 0, [TimeSpan]::Zero)
            $InputStream = [IO.File]::OpenRead((Join-Path $TargetRoot $File))
            $EntryStream = $Entry.Open()
            try { $InputStream.CopyTo($EntryStream) }
            finally { $EntryStream.Dispose(); $InputStream.Dispose() }
        }
    } finally { $Archive.Dispose(); $ZipStream.Dispose() }
    $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        if ($Archive.Entries.Count -ne $Allowed.Count) { throw 'ZIPのファイル数が一致しません。' }
        foreach ($File in $Allowed) {
            $Entry = $Archive.GetEntry($File)
            if (!$Entry) { throw "ZIPにファイルがありません：$File" }
            $Stream = $Entry.Open()
            try { $ZipHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Stream)) }
            finally { $Stream.Dispose() }
            if ($ZipHash -ne (Get-FileHash -LiteralPath (Join-Path $TargetRoot $File)).Hash) { throw "ZIP内容が一致しません：$File" }
        }
    } finally { $Archive.Dispose() }
    $Reports += [ordered]@{ target = $Target; file = [IO.Path]::GetFileName($ZipPath); sha256 = (Get-FileHash -LiteralPath $ZipPath).Hash; files = $Allowed }
}
foreach ($File in $Files) {
    if ((Get-FileHash -LiteralPath (Join-Path $OutputRoot "chromium/$File")).Hash -ne (Get-FileHash -LiteralPath (Join-Path $OutputRoot "firefox/$File")).Hash) { throw "共通ファイルが一致しません：$File" }
}
$Commit = (& git -C $ProjectRoot rev-parse HEAD) -join ''
$Worktree = @(& git -C $ProjectRoot status --porcelain)
[ordered]@{
    version = $Common.version
    generatedUtc = [DateTime]::UtcNow.ToString('o')
    commit = $Commit
    worktree = $Worktree
    powershell = $PSVersionTable.PSVersion.ToString()
    node = (& node --version) -join ''
    archives = $Reports
} | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutputRoot 'verification.json') -Encoding utf8NoBOM
Write-Output '2種類のZIPを生成し、Manifest参照・ZIP内容・共通ファイルの一致を確認しました。'
