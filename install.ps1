#requires -Version 5.1
<#
  DevKit TUI installer — PowerShell
  Użycie:
    pwsh ./install.ps1
    pwsh ./install.ps1 -List
    pwsh ./install.ps1 -Check
    pwsh ./install.ps1 -All -Target opencode
    pwsh ./install.ps1 -Skills work-style,claude-experience -DryRun
#>
[CmdletBinding()]
param(
    [switch]$List,
    [switch]$Check,
    [switch]$All,
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Runtimes,
    [switch]$Frame,
    [string]$InstallRuntime,
    [string[]]$Skills = @(),
    [ValidateSet('opencode','claude','both')]
    [string]$Target = 'both',
    [string]$LocalDir,
    [string]$ArchiveUrl = 'https://github.com/gabeczkag/gabeczkag.github.io/archive/refs/heads/main.zip'
)

$ErrorActionPreference = 'Stop'
$Skills = @($Skills | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$script:Version = '1.0.0'
$script:Source = $null
$script:TempDir = $null
$script:Db = $null
$script:SkillList = @()
$script:OpenCodeDir = if ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME 'opencode/skills' } else { Join-Path $HOME '.config/opencode/skills' }
$script:ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { Join-Path $env:CLAUDE_CONFIG_DIR 'skills' } else { Join-Path $HOME '.claude/skills' }
$script:Ok = 0
$script:Skip = 0
$script:Err = 0
$script:PluginDone = $false
$script:Target = $Target
$script:DryRun = [bool]$DryRun
$script:Force = [bool]$Force

function Write-Info { param([string]$Text) Write-Host $Text }
function Write-Ok { param([string]$Text) Write-Host "[ok]   $Text" }
function Write-Skip { param([string]$Text) Write-Host "[skip] $Text" }
function Write-Warn { param([string]$Text) Write-Host "[warn] $Text" -ForegroundColor Yellow }
function Write-Err { param([string]$Text) Write-Host "[err]  $Text" -ForegroundColor Red }

function Resolve-Source {
    if ($LocalDir) {
        return (Resolve-Path -LiteralPath $LocalDir).Path
    }
    if ($PSScriptRoot) {
        $localDb = Join-Path $PSScriptRoot 'skills/index.json'
        if (Test-Path -LiteralPath $localDb) { return $PSScriptRoot }
    }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('devkit-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $script:TempDir = $tmp
    $zip = Join-Path $tmp 'site.zip'
    Write-Info 'Pobieram archiwum DevKit...'
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $zip -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    $dir = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'gabeczkag.github.io-*' } | Select-Object -First 1
    if (-not $dir) { throw 'Nie znaleziono katalogu repo w archiwum.' }
    return $dir.FullName
}

function Load-Db {
    $dbPath = Join-Path $script:Source 'skills/index.json'
    if (-not (Test-Path -LiteralPath $dbPath)) {
        $dbPath = Join-Path $script:Source 'skills.json'
    }
    if (-not (Test-Path -LiteralPath $dbPath)) { throw "Brak skills/index.json w $($script:Source)" }
    $script:Db = Get-Content -LiteralPath $dbPath -Raw | ConvertFrom-Json
    $script:SkillList = @($script:Db.skills)
}

function Format-Row {
    param([string]$Id, [string]$Source, [string]$Types, [string]$Description, [int]$Width = 120)
    $desc = [string]$Description
    if ($desc.Length -gt 88) { $desc = $desc.Substring(0, 88) }
    $line = '{0,-34} {1,-12} {2,-16} {3}' -f $Id, $Source, $Types, $desc
    if ($line.Length -gt $Width) { $line = $line.Substring(0, $Width) }
    return $line
}

function Show-List {
    Write-Output ('{0,-34} {1,-12} {2,-16} {3}' -f 'ID', 'SOURCE', 'TYPES', 'OPIS')
    foreach ($s in $script:SkillList) {
        $types = @($s.types) -join ','
        Write-Output (Format-Row -Id $s.id -Source $s.source -Types $types -Description $s.description)
    }
}

function Get-OpenCodeIds {
    $ids = @()
    if ($env:DEVKIT_NO_OPENCODE_API -eq '1') { return $ids }
    $cmd = Get-Command opencode -ErrorAction SilentlyContinue
    if (-not $cmd) { return $ids }
    $tmp = [IO.Path]::GetTempFileName()
    try {
        $p = $null
        $isWindowsHost = ($env:OS -eq 'Windows_NT')
        if ($isWindowsHost -and $cmd.Source -match '\.(cmd|bat)$') {
            $p = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', "`"$($cmd.Source)`" api get /api/skill > `"$tmp`"") -NoNewWindow -Wait -PassThru
        } else {
            $p = Start-Process -FilePath $cmd.Source -ArgumentList @('api','get','/api/skill') -RedirectStandardOutput $tmp -NoNewWindow -Wait -PassThru
        }
        if ($p -and $p.ExitCode -eq 0 -and (Test-Path -LiteralPath $tmp)) {
            $raw = Get-Content -LiteralPath $tmp -Raw
            if ($raw) {
                $json = $raw | ConvertFrom-Json
                $ids = @($json.data | ForEach-Object { $_.id })
            }
        }
    } catch {
        $ids = @()
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
    return $ids
}

function Get-OpenCodePluginInstalled {
    $cmd = Get-Command opencode -ErrorAction SilentlyContinue
    if (-not $cmd) { return $false }
    try {
        $out = & opencode plugin list 2>$null
        return [bool]($out -match 'superpowers')
    } catch {
        return $false
    }
}

function Show-Check {
    $ocIds = Get-OpenCodeIds
    $plugin = Get-OpenCodePluginInstalled
    Write-Output ('{0,-34} {1,-9} {2,-9} {3}' -f 'ID', 'OPENCODE', 'CLAUDE', 'SOURCE')
    foreach ($s in $script:SkillList) {
        $o = 'no'
        $c = 'no'
        if ($ocIds -contains $s.id) { $o = 'yes' }
        elseif (Test-Path -LiteralPath (Join-Path $script:OpenCodeDir "$($s.id)/SKILL.md")) { $o = 'yes' }
        if (Test-Path -LiteralPath (Join-Path $script:ClaudeDir "$($s.id)/SKILL.md")) { $c = 'yes' }
        if ($s.install.kind -eq 'builtin') { $o = 'builtin'; $c = 'builtin' }
        if ($s.install.kind -eq 'plugin' -and $plugin) { $o = 'plugin' }
        Write-Output ('{0,-34} {1,-9} {2,-9} {3}' -f $s.id, $o, $c, $s.source)
    }
}

function Show-Runtimes {
    $checks = @(
        @{ Name = 'Go';     Cmd = 'go';      Args = @('version') },
        @{ Name = 'Python'; Cmd = 'python3'; Args = @('--version') },
        @{ Name = 'Rust';   Cmd = 'rustc';   Args = @('--version') },
        @{ Name = 'Node';   Cmd = 'node';    Args = @('-v') },
        @{ Name = 'Java';   Cmd = 'java';    Args = @('-version') },
        @{ Name = '.NET';   Cmd = 'dotnet';  Args = @('--version') }
    )
    foreach ($c in $checks) {
        $cmd = Get-Command $c.Cmd -ErrorAction SilentlyContinue
        if ($cmd) {
            $v = (& $c.Cmd @($c.Args) 2>&1 | Select-Object -First 1)
            Write-Output ('{0,-10} {1}' -f $c.Name, $v)
        } else {
            Write-Output ('{0,-10} {1}' -f $c.Name, 'brak')
        }
    }
}

function Install-Runtime {
    param([string]$Name)
    if ($Name -notin @('go','python','node','java','rust')) {
        throw "Nieznany runtime: $Name (go|python|node|java|rust)"
    }
    if ($script:DryRun) {
        Write-Info "[dry]  zainstalowałbym runtime: $Name"
        return
    }
    $mise = Get-Command mise -ErrorAction SilentlyContinue
    if ($mise) {
        switch ($Name) {
            'go'     { & mise use -g go@latest }
            'python' { & mise use -g python@latest }
            'node'   { & mise use -g node@lts }
            'java'   { & mise use -g java@21 }
            'rust'   {
                if (Get-Command rustup -ErrorAction SilentlyContinue) { & rustup update }
                else { Write-Info 'Brak rustup. Zainstaluj Rust: https://rustup.rs/' }
            }
        }
        Write-Ok "runtime: $Name"
        return
    }
    switch ($Name) {
        'go'     { Write-Info 'Brak mise. Pobierz Go: https://go.dev/dl/' }
        'python' { Write-Info 'Brak mise. Pobierz Python: https://www.python.org/downloads/' }
        'node'   { Write-Info 'Brak mise. Pobierz Node LTS: https://nodejs.org/' }
        'java'   { Write-Info 'Brak mise. Pobierz JDK: https://adoptium.net/' }
        'rust'   { Write-Info 'Brak mise. Zainstaluj Rust: https://rustup.rs/' }
    }
}

function Install-One {
    param($Skill)
    $kind = $Skill.install.kind
    switch ($kind) {
        'builtin' {
            Write-Skip "$($Skill.id) (builtin)"
            $script:Skip++
            return
        }
        'plugin' {
            if ($script:PluginDone) { return }
            $script:PluginDone = $true
            if ($script:Target -eq 'claude') {
                Write-Info 'Claude: superpowers zainstaluj przez /plugin install superpowers@claude-plugins-official'
                return
            }
            if ($script:DryRun) {
                Write-Info "[dry]  opencode plugin add $($Skill.install.package)"
                return
            }
            if (Get-Command opencode -ErrorAction SilentlyContinue) {
                & opencode plugin add $Skill.install.package
                if ($LASTEXITCODE -eq 0) { Write-Ok "plugin: $($Skill.install.package)"; $script:Ok++ }
                else { Write-Err "plugin: $($Skill.install.package)"; $script:Err++ }
            } else {
                Write-Warn "Brak opencode w PATH. Plugin: $($Skill.install.package)"
            }
            return
        }
        'local' {
            $src = Join-Path $script:Source $Skill.install.path
            if (-not (Test-Path -LiteralPath $src)) {
                Write-Err "$($Skill.id): brak $src"
                $script:Err++
                return
            }
            $bases = @()
            if ($script:Target -in @('opencode','both')) { $bases += $script:OpenCodeDir }
            if ($script:Target -in @('claude','both'))   { $bases += $script:ClaudeDir }
            foreach ($base in $bases) {
                $dest = Join-Path $base $Skill.id
                if ((Test-Path -LiteralPath $dest) -and -not $script:Force) {
                    Write-Skip "$($Skill.id) → $dest (już istnieje, użyj -Force)"
                    $script:Skip++
                    continue
                }
                if ($script:DryRun) {
                    Write-Info "[dry]  $($Skill.id) → $dest"
                    $script:Ok++
                    continue
                }
                New-Item -ItemType Directory -Path $base -Force | Out-Null
                if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
                Copy-Item -LiteralPath $src -Destination $base -Recurse -Force
                Write-Ok "$($Skill.id) → $dest"
                $script:Ok++
            }
            return
        }
        default {
            Write-Err "$($Skill.id): nieznany typ instalacji: $kind"
            $script:Err++
        }
    }
}

function Install-Selected {
    param([string[]]$Ids)
    $script:Ok = 0; $script:Skip = 0; $script:Err = 0; $script:PluginDone = $false
    foreach ($id in $Ids) {
        $skill = $script:SkillList | Where-Object { $_.id -eq $id } | Select-Object -First 1
        if (-not $skill) {
            Write-Warn "Nie znaleziono skilla: $id"
            $script:Err++
            continue
        }
        Install-One -Skill $skill
    }
    Write-Host ''
    Write-Host ("Podsumowanie: ok={0}, skip={1}, err={2}" -f $script:Ok, $script:Skip, $script:Err)
}

function Get-TuiWidth {
    try {
        $w = [Console]::WindowWidth
        if ($w -and $w -gt 20) { return ($w - 1) }
    } catch {}
    return 100
}

function Show-TuiFrame {
    param(
        [array]$Items,
        $Selected,
        [int]$Cursor,
        [int]$Top,
        [int]$PageSize,
        [string]$Target
    )
    $esc = [char]27
    $width = Get-TuiWidth
    Write-Host ($esc + '[2J' + $esc + '[H') -NoNewline
    Write-Host ('DEVKIT / TUI   target: {0}   selected: {1}' -f $Target, $Selected.Count)
    Write-Host ('115 skills · ↑↓ move · space select · a all · n none · t target · c check · enter install · q quit')
    Write-Host ('-' * $width)
    $end = [Math]::Min($Top + $PageSize, $Items.Count)
    for ($i = $Top; $i -lt $end; $i++) {
        $s = $Items[$i]
        $mark = if ($Selected.Contains([string]$s.id)) { '[x]' } else { '[ ]' }
        $types = @($s.types) -join ','
        $desc = [string]$s.description
        if ($desc.Length -gt 52) { $desc = $desc.Substring(0, 52) }
        $line = '{0} {1,-32} {2,-10} {3}' -f $mark, $s.id, $s.source, $desc
        if ($line.Length -gt $width) { $line = $line.Substring(0, $width) }
        if ($i -eq $Cursor) {
            Write-Host ($esc + '[7m' + $line + $esc + '[0m')
        } else {
            Write-Host $line
        }
    }
    Write-Host ('-' * $width)
    Write-Host ('{0} / {1}' -f ($Cursor + 1), $Items.Count)
}

function Show-Tui {
    if ([Console]::IsInputRedirected) {
        Write-Info 'TUI wymaga interaktywnego terminala. Użyj -List, -Check, -All lub -Skills.'
        return
    }
    $items = @($script:SkillList)
    $selected = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($id in @('work-style','claude-experience')) { [void]$selected.Add($id) }
    $cursor = 0
    $top = 0
    $pageSize = 20
    try {
        $h = [Console]::WindowHeight
        if ($h -gt 12) { $pageSize = [Math]::Min(24, $h - 8) }
    } catch {}

    while ($true) {
        if ($cursor -lt $top) { $top = $cursor }
        if ($cursor -ge $top + $pageSize) { $top = $cursor - $pageSize + 1 }
        Show-TuiFrame -Items $items -Selected $selected -Cursor $cursor -Top $top -PageSize $pageSize -Target $script:Target

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            ([ConsoleKey]::UpArrow)    { if ($cursor -gt 0) { $cursor-- } }
            ([ConsoleKey]::DownArrow)  { if ($cursor -lt $items.Count - 1) { $cursor++ } }
            ([ConsoleKey]::PageUp)     { $cursor = [Math]::Max(0, $cursor - $pageSize); $top = [Math]::Max(0, $top - $pageSize) }
            ([ConsoleKey]::PageDown)   { $cursor = [Math]::Min($items.Count - 1, $cursor + $pageSize); $top = [Math]::Min([Math]::Max(0, $items.Count - $pageSize), $top + $pageSize) }
            ([ConsoleKey]::Home)       { $cursor = 0; $top = 0 }
            ([ConsoleKey]::End)        { $cursor = $items.Count - 1 }
            ([ConsoleKey]::Spacebar)   {
                $id = [string]$items[$cursor].id
                if ($selected.Contains($id)) { [void]$selected.Remove($id) } else { [void]$selected.Add($id) }
            }
            ([ConsoleKey]::Enter)      {
                if ($selected.Count -eq 0) { continue }
                Write-Host ''
                Install-Selected -Ids @($selected)
                Write-Host ''
                Write-Host 'Naciśnij dowolny klawisz...'
                [void][Console]::ReadKey($true)
                return
            }
            default {
                switch ($key.KeyChar) {
                    'a' { foreach ($s in $items) { if ($s.install.kind -ne 'builtin') { [void]$selected.Add([string]$s.id) } } }
                    'n' { $selected.Clear() }
                    't' {
                        $script:Target = switch ($script:Target) {
                            'both'     { 'opencode' }
                            'opencode' { 'claude' }
                            'claude'   { 'both' }
                            default    { 'both' }
                        }
                    }
                    'c' {
                        Write-Host ''
                        Show-Check
                        Write-Host ''
                        Write-Host 'Naciśnij dowolny klawisz...'
                        [void][Console]::ReadKey($true)
                    }
                    'q' { return }
                }
            }
        }
    }
}

# main
try {
    $script:Source = Resolve-Source
    Load-Db

    if ($List) { Show-List; return }
    if ($Check) { Show-Check; return }
    if ($Runtimes) { Show-Runtimes; return }
    if ($InstallRuntime) { Install-Runtime -Name $InstallRuntime; return }
    if ($Frame) {
        $selected = New-Object 'System.Collections.Generic.HashSet[string]'
        Show-TuiFrame -Items @($script:SkillList) -Selected $selected -Cursor 0 -Top 0 -PageSize 20 -Target $script:Target
        return
    }

    Write-Info "DevKit $($script:Version) — cel: $($script:Target)"
    if ($All) {
        $ids = @($script:SkillList | Where-Object { $_.install.kind -ne 'builtin' } | ForEach-Object { $_.id })
        Install-Selected -Ids $ids
    } elseif ($Skills.Count -gt 0) {
        Install-Selected -Ids $Skills
    } else {
        Show-Tui
    }

    if ($script:Err -gt 0) { exit 1 }
} finally {
    if ($script:TempDir -and (Test-Path -LiteralPath $script:TempDir)) {
        Remove-Item -LiteralPath $script:TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
