<#
.SYNOPSIS
    Automated Nightly Database Backup Script for TAHDCO UDP MySQL Database.
.DESCRIPTION
    This script parses backend appsettings.json for MySQL connection credentials,
    finds mysqldump.exe on the system, performs a database dump, compresses the output,
    and applies a 7-day retention cleanup policy.
.NOTES
    Author: Antigravity Code Assistant
    Date: 2026-07-23
#>

$ErrorActionPreference = "Stop"

# Configuration
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$AppSettingsPath = "$ProjectRoot\backend\API\appsettings.json"
$BackupDir = "$ProjectRoot\database\backups"
$LogPath = "$BackupDir\backup_log.txt"
$RetentionDays = 7

# Ensure Backup Directory exists
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

function Write-Log($Message, $Type = "INFO") {
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Type] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogPath -Value $LogMessage
}

Write-Log "Starting automated database backup..."

# 1. Read and parse Connection String from appsettings.json
if (!(Test-Path $AppSettingsPath)) {
    Write-Log "appsettings.json not found at $AppSettingsPath. Backup aborted." "ERROR"
    exit 1
}

try {
    $Settings = Get-Content $AppSettingsPath -Raw | ConvertFrom-Json
    $ConnStr = $Settings.ConnectionStrings.Default
    if (!$ConnStr) {
        $ConnStr = $Settings.ConnectionStrings.DefaultConnection
    }
    if (!$ConnStr) {
        Write-Log "Default or DefaultConnection connection string is missing in appsettings.json." "ERROR"
        exit 1
    }
}
catch {
    Write-Log "Failed to parse appsettings.json: $_" "ERROR"
    exit 1
}

# Parse connection string variables
$Server = ""
$Database = ""
$User = ""
$Password = ""

$ConnStr.Split(";") | ForEach-Object {
    $Parts = $_.Split("=")
    if ($Parts.Length -eq 2) {
        $Key = $Parts[0].Trim().ToLower()
        $Val = $Parts[1].Trim()
        switch ($Key) {
            "server" { $Server = $Val }
            "database" { $Database = $Val }
            "uid" { $User = $Val }
            "user" { $User = $Val }
            "user id" { $User = $Val }
            "pwd" { $Password = $Val }
            "password" { $Password = $Val }
        }
    }
}

if (!$Server -or !$Database -or !$User -or !$Password) {
    Write-Log "Could not parse all connection string components (Server: '$Server', Database: '$Database', User: '$User')." "ERROR"
    exit 1
}

Write-Log "Target Database: $Database on server $Server with user $User"

# 2. Locate mysqldump.exe
$DumpPaths = @(
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
    "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe",
    "C:\xampp\mysql\bin\mysqldump.exe",
    "C:\Program Files\MariaDB *\bin\mysqldump.exe",
    "mysqldump.exe" # Fallback if in PATH
)

$DumpExe = ""
foreach ($Path in $DumpPaths) {
    if ($Path.Contains("*")) {
        $Expanded = Resolve-Path $Path -ErrorAction SilentlyContinue
        if ($Expanded) {
            $DumpExe = $Expanded.Path
            break
        }
    }
    elseif (Test-Path $Path) {
        $DumpExe = $Path
        break
    }
}

if (!$DumpExe) {
    # Check if in system PATH
    $DumpExe = Get-Command mysqldump.exe -ErrorAction SilentlyContinue
    if ($DumpExe) {
        $DumpExe = $DumpExe.Source
    }
}

if (!$DumpExe) {
    Write-Log "mysqldump.exe could not be located on this machine. Please install MySQL client tools." "ERROR"
    exit 1
}

Write-Log "Using mysqldump tool path: $DumpExe"

# 3. Perform dump
$DateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$SqlFile = "$BackupDir\tahdco_udp_backup_$DateStr.sql"
$ZipFile = "$BackupDir\tahdco_udp_backup_$DateStr.zip"

Write-Log "Exporting database backup to $SqlFile..."

try {
    # Setup environment variable for password to avoid CLI warning
    $env:MYSQL_PWD = $Password
    
    # Run mysqldump
    & $DumpExe --host=$Server --user=$User $Database --result-file=$SqlFile --single-transaction --routines --triggers --no-tablespaces
    
    if (Test-Path $SqlFile) {
        $FileSize = (Get-Item $SqlFile).Length
        Write-Log "SQL dump completed successfully. File size: $FileSize bytes"
        
        # 4. Compress to ZIP
        Write-Log "Compressing backup to $ZipFile..."
        Compress-Archive -Path $SqlFile -DestinationPath $ZipFile -Force
        
        # Remove raw SQL file to save space
        Remove-Item $SqlFile -Force
        Write-Log "Compression complete. Raw SQL removed."
    }
    else {
        Write-Log "Backup file was not created. Process failed." "ERROR"
        exit 1
    }
}
catch {
    Write-Log "Backup execution failed: $_" "ERROR"
    exit 1
}
finally {
    # Clear password env var
    $env:MYSQL_PWD = ""
}

# 5. Apply Retention Policy (keep last 7 days)
Write-Log "Applying retention policy (deleting items older than $RetentionDays days)..."
try {
    Get-ChildItem -Path $BackupDir -Filter "*.zip" | ForEach-Object {
        $Age = (Get-Date) - $_.LastWriteTime
        if ($Age.Days -ge $RetentionDays) {
            Write-Log "Deleting old backup file: $($_.Name) (Age: $($Age.Days) days)"
            Remove-Item $_.FullName -Force
        }
    }
}
catch {
    Write-Log "Error during retention policy cleanup: $_" "WARN"
}

Write-Log "Automated database backup completed successfully."
