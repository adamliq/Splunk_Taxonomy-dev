#Requires -Version 5.1
<#
.SYNOPSIS
    Log Assessment Framework -- standalone PowerShell implementation for
    disconnected/air-gapped environments (no Python, no internet, no AI
    access required).

.DESCRIPTION
    Implements the full documented procedure from the "Log Assessment
    Framework" reference article: raw ingest (encoding/BOM/line-ending
    detection), physical-line splitting, a majority-baseline record-start
    rule with continuation folding, per-event feature extraction, majority
    baseline computation per axis, byte/event/percentage three-way
    conformance scoring (including the two counting units -- line-level vs.
    event-level), attributed non-conformer reporting, and structural
    fingerprinting (including the degenerate-base-tuple type_key extension
    and deterministic "Naming the derived shape" codenames).

    Behaviourally ported from apply_framework_v1_lib.py in the same
    repository and validated against the same test corpus -- see
    ../run_regression_suite.py and README.md for the methodology. The word
    lists and hashing scheme in the codename generator are IDENTICAL to
    shape_naming.py, so the same structural shape produces the same
    codename whether it was assessed with this script or the Python tool,
    on any machine, matching the framework's stated determinism guarantee.

    Works on Windows PowerShell 5.1 (built into every supported Windows
    release, no install required) and PowerShell 7+ (pwsh, cross-platform).

.PARAMETER Path
    Path to the raw log file to assess.

.PARAMETER JsonOutput
    Optional path to also write the full assessment as JSON.

.PARAMETER ShowNonConformers
    Print the full non-conformer list (line number + attributed reasons)
    instead of just the count and a handful of examples.

.PARAMETER MaxNonConformerExamples
    How many non-conformer examples to print when -ShowNonConformers is not
    set. Default 15.

.EXAMPLE
    .\Assess-LogFile.ps1 -Path C:\logs\app.log

.EXAMPLE
    .\Assess-LogFile.ps1 -Path .\sample.log -JsonOutput .\report.json -ShowNonConformers

.NOTES
    Scale: the framework itself is a sampling procedure -- its own worked
    example reasons about a 10,000-line sample, not a full production log --
    and this script is built and validated against that scale (the largest
    corpus file plus a 50,000-line stress file, both well under two minutes
    on ordinary hardware). Pure PowerShell's per-object and per-cmdlet-call
    overhead makes it noticeably slower than the Python reference
    implementation at that size, so for a multi-million-line source, assess
    a representative excerpt (e.g. a recent time window, or one file from a
    rotation) rather than the whole thing. If a file has a single dominant
    format AND a single dominant timestamp format (the "degenerate base
    tuple" case), fingerprinting re-parses every JSON event individually to
    tell distinct schemas apart, which is the single largest cost on large
    homogeneous JSON logs -- expected, not a bug.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Path,

    [string]$JsonOutput,

    [switch]$ShowNonConformers,

    [int]$MaxNonConformerExamples = 15
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# =====================================================================
# Timestamp pattern library (search-based, per the framework: a fixed
# prefix like a JSON wrapper or syslog priority tag pushes the timestamp
# off offset 0, so an anchored match would miss it).
# =====================================================================
$script:TsPatterns = @(
    [PSCustomObject]@{ Name = 'iso8601_offset_ms';    Regex = [regex]::new('\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+\-]\d{2}:\d{2}') }
    [PSCustomObject]@{ Name = 'iso8601_offset_no_ms'; Regex = [regex]::new('\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{2}:\d{2}') }
    [PSCustomObject]@{ Name = 'iso8601_space_hms';    Regex = [regex]::new('\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}') }
    [PSCustomObject]@{ Name = 'iso8601_naive';        Regex = [regex]::new('\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?![+\-.\d])') }
    [PSCustomObject]@{ Name = 'syslog_no_year';       Regex = [regex]::new('[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}') }
    [PSCustomObject]@{ Name = 'slash_date_hms';       Regex = [regex]::new('\d{2}/\d{2}/\d{4}\s\d{2}:\d{2}:\d{2}') }
    [PSCustomObject]@{ Name = 'iso8601_slash_hms';    Regex = [regex]::new('\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}') }
)

function Find-Timestamp {
    param([string]$Text)
    foreach ($p in $script:TsPatterns) {
        $m = $p.Regex.Match($Text)
        if ($m.Success) {
            return [PSCustomObject]@{ Name = $p.Name; Offset = $m.Index; Width = $m.Length }
        }
    }
    return $null
}

# =====================================================================
# Format classification
# =====================================================================
function Get-LineFormat {
    param([string]$Text)
    $t = $Text.Trim()
    if ($t.Length -eq 0) { return 'EMPTY' }
    if ($t.StartsWith('{')) {
        try {
            $null = ConvertFrom-Json -InputObject $t -ErrorAction Stop
            return 'json'
        } catch {
            return 'json_like_malformed'
        }
    }
    if ($t -match '^<\d+>') { return 'syslog_priority' }
    if (($t.Split('|').Count - 1) -ge 3) { return 'pipe_delimited' }
    if ($t.Contains(',') -and ($t -match '^\d{2}/\d{2}/\d{4}')) { return 'csv_dated' }
    return 'OTHER'
}

# =====================================================================
# Record-start rule (CORRECTED per the reference article fix). Continuation
# status must be EARNED, not defaulted: only leading whitespace/tab counts
# as evidence of continuation. A line with no leading whitespace that
# matches no known record-start pattern is NOT a continuation by default --
# it starts its own record and is left to fail conformance / bucket as
# FREE_TEXT on its own merits, rather than being silently folded into
# whatever record preceded it. (Applied inline in the Step 4 grouping loop
# below rather than as a standalone predicate, so classification can be
# cached and reused in Step 5 -- see the comment there.)
# =====================================================================

# =====================================================================
# Step 1-2: raw ingest + physical line split, preserving BOM / CRLF / LF.
# Decodes the whole file once (fast) rather than byte-by-byte, then scans
# for line boundaries with IndexOf (fast native search) -- both matter for
# usable performance on realistic log file sizes.
# =====================================================================
function Read-RawLines {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $hasBom = $false
    $offset = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $hasBom = $true
        $offset = 3
    }

    # UTF8Encoding with throwOnInvalidBytes=$false replaces invalid
    # sequences instead of crashing -- matches Python's errors="replace".
    $enc = New-Object System.Text.UTF8Encoding($false, $false)
    $fullText = $enc.GetString($bytes, $offset, $bytes.Length - $offset)

    $lines = New-Object System.Collections.Generic.List[object]
    $start = 0
    $len = $fullText.Length
    while ($start -le $len) {
        $nl = $fullText.IndexOf("`n", $start)
        if ($nl -lt 0) {
            if ($start -lt $len) {
                $lines.Add([PSCustomObject]@{ Text = $fullText.Substring($start); Ending = 'NONE' })
            }
            break
        }
        if ($nl -gt $start -and $fullText[$nl - 1] -eq "`r") {
            $lines.Add([PSCustomObject]@{ Text = $fullText.Substring($start, $nl - $start - 1); Ending = 'CRLF' })
        } else {
            $lines.Add([PSCustomObject]@{ Text = $fullText.Substring($start, $nl - $start); Ending = 'LF' })
        }
        $start = $nl + 1
    }

    return [PSCustomObject]@{ HasBom = $hasBom; TotalBytes = $bytes.Length; Lines = $lines }
}

function Get-Utf8ByteCount {
    param([string]$Text)
    return [System.Text.Encoding]::UTF8.GetByteCount($Text)
}

function Get-SumSafe {
    # Measure-Object emits NO output at all for an empty pipeline (not an
    # object with Sum=0), and under Set-StrictMode -Version Latest,
    # accessing .Sum on that $null throws instead of silently returning
    # $null -- so every aggregate sum in this script goes through here.
    param([object[]]$Items, [string]$Property)
    if (-not $Items -or $Items.Count -eq 0) { return 0 }
    $m = $Items | Measure-Object -Property $Property -Sum
    if ($null -eq $m -or $null -eq $m.Sum) { return 0 }
    return $m.Sum
}

# =====================================================================
# Naive (structure-UNAWARE) field counter -- deliberately naive so the
# delimiter-collision pitfall (a quoted comma) is reproducible, not
# silently avoided by smarter parsing. Applies to any format with a
# countable delimiter, not just named CSV/pipe buckets.
# =====================================================================
function Get-FieldCount {
    param([string]$Text, [string]$Format)
    if ($Format -eq 'json' -or $Format -eq 'FREE_TEXT') { return $null }
    if ($Text.Contains('|')) { return $Text.Split('|').Count }
    if ($Text.Contains(',')) { return $Text.Split(',').Count }
    return $null
}

# =====================================================================
# Structural fingerprinting: shape naming ("Naming the derived shape").
# Word lists and formula are IDENTICAL to shape_naming.py -- the same
# structural shape must produce the same codename regardless of which
# tool assessed it.
# =====================================================================
$script:FmtAdjectives = @('amber','bold','calm','dusty','ember','faded','gentle','hazy','icy','jagged','keen','lively','misty','noble','opal','pale','quiet','rustic','silver','tidal','umber','vivid','warm','young')
$script:FmtNouns      = @('adder','badger','condor','drake','egret','falcon','grouse','heron','ibis','jackal','kite','lynx','marten','newt','osprey','puffin','quail','raven','shrike','tern','urchin','viper','wren','yak')

$script:Md5 = [System.Security.Cryptography.MD5]::Create()

function Get-Md5Hex8 {
    param([string]$Text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $script:Md5.ComputeHash($bytes)
    $hex = -join ($hash | ForEach-Object { $_.ToString('x2') })
    return $hex.Substring(0, 8)
}

function Get-CodenameFromHash {
    param([string]$ShapeHash)
    $b0 = [Convert]::ToInt32($ShapeHash.Substring(0, 2), 16)
    $b1 = [Convert]::ToInt32($ShapeHash.Substring(2, 2), 16)
    $adj = $script:FmtAdjectives[$b0 % $script:FmtAdjectives.Count]
    $noun = $script:FmtNouns[$b1 % $script:FmtNouns.Count]
    return "FMT-$adj-$noun-$($ShapeHash.Substring(0,4))"
}

function Get-MaskedSkeleton {
    param([string]$Text)
    $digitEval = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) '9' * $m.Value.Length }
    $alphaEval = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) 'A' * $m.Value.Length }
    $out = [regex]::Replace($Text, '\d+', $digitEval)
    $out = [regex]::Replace($out, '[A-Za-z]+', $alphaEval)
    return $out
}

function Get-ShapeToken {
    param([string]$Text, [string]$Format)
    if ($Format -eq 'pipe_delimited') {
        return "pipe/$($Text.Split('|').Count)"
    }
    if ($Format -eq 'OTHER') {
        return Get-MaskedSkeleton $Text
    }
    return $Format
}

function Get-TypeKey {
    # Only used when the base (format|ts_format) tuple is degenerate.
    # For JSON, the sorted set of top-level keys; other formats have no
    # cheap schema signature available and return $null.
    param([string]$Text, [string]$Format)
    if ($Format -ne 'json') { return $null }
    try {
        $obj = ConvertFrom-Json -InputObject $Text -ErrorAction Stop
        $props = $obj.PSObject.Properties.Name | Sort-Object
        return ($props -join ',')
    } catch {
        return $null
    }
}

# =====================================================================
# Main assessment
# =====================================================================
function Invoke-LogAssessment {
    param([string]$Path)

    $raw = Read-RawLines -Path $Path

    # ---- Step 4: record-start rule + fold continuation lines into events ----
    # Classification (format + timestamp) is computed AT MOST ONCE per
    # physical line, inline, and cached for reuse in Step 5 -- calling
    # Get-LineFormat/Find-Timestamp a second time per head line (once to
    # decide record-start, again to annotate the event) roughly doubled
    # runtime at realistic file sizes, since PowerShell's per-function-call
    # overhead is the dominant cost here, not the classification work
    # itself. Continuation lines (leading whitespace/tab) skip
    # classification entirely, per the record-start rule.
    $events = New-Object System.Collections.Generic.List[object]
    $current = $null
    $lineNo = 0
    foreach ($line in $raw.Lines) {
        $lineNo++
        $text = $line.Text
        $isStart = $true
        $fmt = $null
        $ts = $null
        if ($text.Length -eq 0) {
            $isStart = $false
        } elseif ($text[0] -eq "`t" -or $text[0] -eq ' ') {
            $isStart = $false
        } else {
            # Per the corrected record-start rule, any non-empty, non-
            # whitespace-led line always starts a new record regardless of
            # what it classifies as -- so $isStart is unconditionally true
            # here. Classification is still needed either way, both to
            # decide whether it happens to also match a named record-start
            # pattern (informational only now) and because it will be used
            # for annotation once this line is confirmed as a head.
            $fmt = Get-LineFormat $text
            $ts = Find-Timestamp $text
        }
        if ($null -eq $current -or $isStart) {
            if ($null -ne $current) { $events.Add($current) }
            $current = [PSCustomObject]@{ Lines = New-Object System.Collections.Generic.List[object]; Fmt = $fmt; Ts = $ts }
        }
        $current.Lines.Add([PSCustomObject]@{ Text = $text; Ending = $line.Ending; LineNo = $lineNo })
    }
    if ($null -ne $current) { $events.Add($current) }

    # ---- Step 5: per-event feature extraction (reusing cached Fmt/Ts) ----
    # Built as ONE hashtable-literal PSCustomObject per event rather than a
    # bare object plus repeated Add-Member calls -- Add-Member's per-call
    # overhead dominates runtime at realistic (tens of thousands of lines)
    # file sizes, easily 10x+ slower than single-shot construction.
    $annotated = New-Object System.Collections.Generic.List[object]
    foreach ($ev in $events) {
        $head = $ev.Lines[0]
        # The very first event in the file never went through the record-
        # start branch above (short-circuited by $current -eq $null), so
        # its classification may still be uncached.
        $fmt = if ($null -ne $ev.Fmt) { $ev.Fmt } else { Get-LineFormat $head.Text }
        $ts = if ($null -ne $ev.Fmt) { $ev.Ts } else { Find-Timestamp $head.Text }

        if ($fmt -eq 'OTHER') {
            if ($head.Text -match '[|,{]') { $fmt = 'OTHER' } else { $fmt = 'FREE_TEXT' }
        }

        $c0 = if ($head.Text.Length -gt 0) { $head.Text[0] } else { $null }
        $fcc = if ($null -eq $c0) { 'empty' } elseif ([char]::IsDigit($c0)) { 'digit' } elseif ([char]::IsLetter($c0)) { 'alpha' } else { 'symbol' }

        $bytes = 0
        foreach ($l in $ev.Lines) {
            $bytes += (Get-Utf8ByteCount $l.Text) + $(switch ($l.Ending) { 'CRLF' { 2 }; 'LF' { 1 }; default { 0 } })
        }

        $annotated.Add([PSCustomObject]@{
            Lines          = $ev.Lines
            Format         = $fmt
            TsFormat       = $(if ($ts) { $ts.Name } else { $null })
            TsOffset       = $(if ($ts) { $ts.Offset } else { $null })
            TsWidth        = $(if ($ts) { $ts.Width } else { $null })
            FieldCount     = Get-FieldCount -Text $head.Text -Format $fmt
            FirstCharClass = $fcc
            Structure      = $(if ($ev.Lines.Count -eq 1) { 'single' } else { 'multi' })
            LineEnding     = $head.Ending
            LineCount      = $ev.Lines.Count
            Bytes          = $bytes
        })
    }
    $events = $annotated

    $totalEvents = $events.Count
    if ($totalEvents -eq 0) {
        throw "No events found in '$Path' (empty file?)."
    }

    # ---- Step 6: majority baseline per axis ----
    function Get-Majority {
        param([object[]]$Values)
        ($Values | Where-Object { $null -ne $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 1).Name
    }

    $majFmt   = Get-Majority ($events.Format)
    $majTs    = Get-Majority ($events.TsFormat)
    $majStruct= Get-Majority ($events.Structure)
    $majFcc   = Get-Majority ($events.FirstCharClass)
    $majEnd   = Get-Majority ($events.LineEnding)

    $conformsAll = {
        param($e)
        $e.Format -eq $majFmt -and $e.TsFormat -eq $majTs -and $e.Structure -eq $majStruct -and
        $e.FirstCharClass -eq $majFcc -and $e.LineEnding -eq $majEnd
    }

    $confEvents = @($events | Where-Object { & $conformsAll $_ })
    $nonconfEvents = @($events | Where-Object { -not (& $conformsAll $_) })
    $allConf = $confEvents.Count

    # ---- Two counting units: line-level vs. event-level ----
    $totalLines = $raw.Lines.Count
    $conformingLines = Get-SumSafe -Items $confEvents -Property 'LineCount'
    $lineLevelPct = if ($totalLines -gt 0) { [math]::Round(100 * $conformingLines / $totalLines, 4) } else { $null }
    $eventLevelPct = if ($totalEvents -gt 0) { [math]::Round(100 * $allConf / $totalEvents, 4) } else { $null }

    # ---- Per-axis three-way (bytes / events / percentage) partition report ----
    $totalBytesAll = Get-SumSafe -Items $events -Property 'Bytes'

    function Get-AxisPartition {
        param([string]$AxisName, [string]$PropertyName, $Baseline)
        $conf = @($events | Where-Object { $_.$PropertyName -eq $Baseline })
        $nonconf = @($events | Where-Object { $_.$PropertyName -ne $Baseline })
        $confBytes = Get-SumSafe -Items $conf -Property 'Bytes'
        $nonconfBytes = Get-SumSafe -Items $nonconf -Property 'Bytes'
        [PSCustomObject]@{
            Axis = $AxisName
            Baseline = $Baseline
            ConfEvents = $conf.Count
            ConfBytes = $confBytes
            ConfPctEvents = [math]::Round(100 * $conf.Count / $totalEvents, 2)
            ConfPctBytes = $(if ($totalBytesAll -gt 0) { [math]::Round(100 * $confBytes / $totalBytesAll, 2) } else { $null })
            NonconfEvents = $nonconf.Count
            NonconfBytes = $nonconfBytes
            NonconfPctEvents = [math]::Round(100 * $nonconf.Count / $totalEvents, 2)
            NonconfPctBytes = $(if ($totalBytesAll -gt 0) { [math]::Round(100 * $nonconfBytes / $totalBytesAll, 2) } else { $null })
        }
    }

    $axisDefs = @(
        @{ Name = 'format'; Prop = 'Format'; Base = $majFmt }
        @{ Name = 'ts_format'; Prop = 'TsFormat'; Base = $majTs }
        @{ Name = 'structure'; Prop = 'Structure'; Base = $majStruct }
        @{ Name = 'first_char_class'; Prop = 'FirstCharClass'; Base = $majFcc }
        @{ Name = 'line_ending'; Prop = 'LineEnding'; Base = $majEnd }
    )
    $summaryBlock = @(foreach ($a in $axisDefs) { Get-AxisPartition -AxisName $a.Name -PropertyName $a.Prop -Baseline $a.Base })

    # ---- Non-conformer list, attributed reasons ----
    $nonConformers = @(foreach ($e in $nonconfEvents) {
        $reasons = New-Object System.Collections.Generic.List[string]
        if ($e.Format -ne $majFmt) { $reasons.Add("format=$($e.Format) (majority=$majFmt)") }
        if ($e.TsFormat -ne $majTs) { $reasons.Add("ts_format=$($e.TsFormat) (majority=$majTs)") }
        if ($e.Structure -ne $majStruct) { $reasons.Add("structure=$($e.Structure) (majority=$majStruct)") }
        if ($e.FirstCharClass -ne $majFcc) { $reasons.Add("first_char_class=$($e.FirstCharClass) (majority=$majFcc)") }
        if ($e.LineEnding -ne $majEnd) { $reasons.Add("line_ending=$($e.LineEnding) (majority=$majEnd)") }
        [PSCustomObject]@{ Line = $e.Lines[0].LineNo; Reasons = @($reasons) }
    })

    # ---- Step 10: structural fingerprinting, with degenerate-base-tuple extension ----
    $distinctFormats = @($events | Where-Object { $_.Format -ne 'FREE_TEXT' } | ForEach-Object Format | Select-Object -Unique)
    $distinctTs = @($events | Where-Object { $_.Format -ne 'FREE_TEXT' } | ForEach-Object TsFormat | Select-Object -Unique)
    $baseTupleDegenerate = ($distinctFormats.Count -le 1) -and ($distinctTs.Count -le 1)

    $fingerprints = @{}
    $shapeNames = @{}
    $unnamedFormats = @('pipe_delimited', 'OTHER')
    foreach ($ev in $events) {
        if ($ev.Format -eq 'FREE_TEXT') {
            $fingerprints['FREE_TEXT'] = [int]($fingerprints['FREE_TEXT']) + 1
            continue
        }
        $shape = Get-ShapeToken -Text $ev.Lines[0].Text -Format $ev.Format
        $key = "$shape|$($ev.TsFormat)"
        if ($baseTupleDegenerate) {
            $typeKey = Get-TypeKey -Text $ev.Lines[0].Text -Format $ev.Format
            $key = "$key|$typeKey"
        }
        $fp = Get-Md5Hex8 $key
        $fingerprints[$fp] = [int]($fingerprints[$fp]) + 1
        if ($ev.Format -in $unnamedFormats -and -not $shapeNames.ContainsKey($fp)) {
            $shapeHash = Get-Md5Hex8 $shape
            $codename = Get-CodenameFromHash $shapeHash
            $shapeNames[$fp] = [PSCustomObject]@{ ShapeToken = $shape; ShapeHash = $shapeHash; Codename = $codename }
        }
    }
    $distinctFingerprints = @($fingerprints.Keys | Where-Object { $_ -ne 'FREE_TEXT' }).Count
    $freeTextEvents = if ($fingerprints.ContainsKey('FREE_TEXT')) { $fingerprints['FREE_TEXT'] } else { 0 }

    # ---- Supporting aggregates (timestamp width/offset, field count) ----
    # Built with HashSet for fast dedup, then converted to plain sorted
    # arrays -- ConvertTo-Json cannot serialize a live HashSet.
    $tsWidthSets = @{}
    $tsOffsetSets = @{}
    foreach ($e in $events) {
        if ($e.TsFormat) {
            if (-not $tsWidthSets.ContainsKey($e.TsFormat)) { $tsWidthSets[$e.TsFormat] = New-Object System.Collections.Generic.HashSet[int] }
            [void]$tsWidthSets[$e.TsFormat].Add($e.TsWidth)
            if (-not $tsOffsetSets.ContainsKey($e.TsFormat)) { $tsOffsetSets[$e.TsFormat] = New-Object System.Collections.Generic.HashSet[int] }
            [void]$tsOffsetSets[$e.TsFormat].Add($e.TsOffset)
        }
    }
    $tsWidthByFormat = @{}
    foreach ($k in $tsWidthSets.Keys) { $tsWidthByFormat[$k] = @($tsWidthSets[$k] | Sort-Object) }
    $tsOffsetByFormat = @{}
    foreach ($k in $tsOffsetSets.Keys) { $tsOffsetByFormat[$k] = @($tsOffsetSets[$k] | Sort-Object) }
    # Dictionary keys must be strings for ConvertTo-Json -- field_count is
    # an int, so it's stringified as the key (matches how Python's
    # int-keyed dict round-trips through json.dumps: keys become strings).
    $fieldCountDistribution = @{}
    foreach ($e in $events) {
        if ($null -ne $e.FieldCount) {
            if (-not $fieldCountDistribution.ContainsKey($e.Format)) { $fieldCountDistribution[$e.Format] = @{} }
            $fc = [string]$e.FieldCount
            $fieldCountDistribution[$e.Format][$fc] = [int]($fieldCountDistribution[$e.Format][$fc]) + 1
        }
    }

    return [PSCustomObject]@{
        File = $Path
        HasBom = $raw.HasBom
        TotalPhysicalLines = $totalLines
        TotalLogicalEvents = $totalEvents
        ContinuationLines = $totalLines - $totalEvents
        Majority = [PSCustomObject]@{ Format = $majFmt; TsFormat = $majTs; Structure = $majStruct; FirstCharClass = $majFcc; LineEnding = $majEnd }
        FormatBreakdown = @($events | Group-Object Format | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; Count = $_.Count } })
        TsFormatBreakdown = @($events | Where-Object TsFormat | Group-Object TsFormat | ForEach-Object { [PSCustomObject]@{ Name = $_.Name; Count = $_.Count } })
        TsWidthByFormat = $tsWidthByFormat
        TsOffsetByFormat = $tsOffsetByFormat
        FieldCountDistribution = $fieldCountDistribution
        AllAxesConformingEvents = $allConf
        AllAxesConformingLines = $conformingLines
        LineLevelPct = $lineLevelPct
        EventLevelPct = $eventLevelPct
        SummaryBlock = $summaryBlock
        NonConformers = $nonConformers
        BaseTupleDegenerate = $baseTupleDegenerate
        DistinctFingerprintsExclFreeText = $distinctFingerprints
        FreeTextEvents = $freeTextEvents
        ShapeNames = $shapeNames
    }
}

# =====================================================================
# Console report
# =====================================================================
function Write-AssessmentReport {
    param($Result)

    Write-Host ""
    Write-Host "=== Log Assessment Framework -- $($Result.File) ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "A. Executive conclusion" -ForegroundColor Yellow
    Write-Host "   Physical lines: $($Result.TotalPhysicalLines)   Logical events: $($Result.TotalLogicalEvents)   Continuation lines: $($Result.ContinuationLines)"
    Write-Host "   BOM present: $($Result.HasBom)"
    Write-Host ("   All-axes conformance -- event-level: {0}%   line-level: {1}%" -f $Result.EventLevelPct, $Result.LineLevelPct)
    if ($Result.ContinuationLines -gt 0 -and $Result.LineLevelPct -ne $Result.EventLevelPct) {
        Write-Host "   (line-level and event-level diverge -- multi-line/folded records are present)"
    }
    Write-Host "   Majority baseline: format=$($Result.Majority.Format) ts_format=$($Result.Majority.TsFormat) structure=$($Result.Majority.Structure) first_char_class=$($Result.Majority.FirstCharClass) line_ending=$($Result.Majority.LineEnding)"

    Write-Host ""
    Write-Host "B. Assessment summary block (per axis: conforming / non-conforming, by events and bytes)" -ForegroundColor Yellow
    Write-Host ("   {0,-18} {1,-20} {2,10} {3,8} {4,10} {5,8} {6,10} {7,8} {8,10} {9,8}" -f 'Axis', 'Baseline', 'ConfEvt', 'Conf%Ev', 'ConfBytes', 'Conf%By', 'NConfEvt', 'NConf%Ev', 'NConfByt', 'NConf%By')
    foreach ($row in $Result.SummaryBlock) {
        Write-Host ("   {0,-18} {1,-20} {2,10} {3,8} {4,10} {5,8} {6,10} {7,8} {8,10} {9,8}" -f $row.Axis, $row.Baseline, $row.ConfEvents, $row.ConfPctEvents, $row.ConfBytes, $row.ConfPctBytes, $row.NonconfEvents, $row.NonconfPctEvents, $row.NonconfBytes, $row.NonconfPctBytes)
    }
    Write-Host ""

    Write-Host "C. Structural fingerprint summary" -ForegroundColor Yellow
    Write-Host "   Distinct structural types (excl. FREE_TEXT): $($Result.DistinctFingerprintsExclFreeText)"
    Write-Host "   FREE_TEXT events: $($Result.FreeTextEvents)"
    if ($Result.BaseTupleDegenerate) {
        Write-Host "   Base (format|timestamp_format) tuple is degenerate -- fingerprint extended with a type_key."
    }
    if ($Result.ShapeNames.Count -gt 0) {
        Write-Host "   Named/derived shapes for unnamed formats:"
        foreach ($kv in $Result.ShapeNames.GetEnumerator()) {
            Write-Host ("     {0}  shape={1}  codename={2}" -f $kv.Key, $kv.Value.ShapeToken, $kv.Value.Codename)
        }
    }

    Write-Host ""
    Write-Host "D. Non-conformers ($($Result.NonConformers.Count) total)" -ForegroundColor Yellow
    $toShow = if ($ShowNonConformers) { $Result.NonConformers } else { $Result.NonConformers | Select-Object -First $MaxNonConformerExamples }
    foreach ($nc in $toShow) {
        Write-Host ("   line {0}: {1}" -f $nc.Line, ($nc.Reasons -join '; '))
    }
    if (-not $ShowNonConformers -and $Result.NonConformers.Count -gt $MaxNonConformerExamples) {
        Write-Host "   ... and $($Result.NonConformers.Count - $MaxNonConformerExamples) more (use -ShowNonConformers to see all)"
    }

    Write-Host ""
    Write-Host "E. Timestamp width / offset by format (fixed-width-trap / prefix-offset evidence)" -ForegroundColor Yellow
    foreach ($kv in $Result.TsWidthByFormat.GetEnumerator()) {
        $offsets = $Result.TsOffsetByFormat[$kv.Key]
        Write-Host ("   {0}: widths=[{1}]  offsets=[{2}]" -f $kv.Key, (($kv.Value | Sort-Object) -join ','), (($offsets | Sort-Object) -join ','))
    }

    Write-Host ""
}

# =====================================================================
# Entry point
# =====================================================================
if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
}

$result = Invoke-LogAssessment -Path $Path
Write-AssessmentReport -Result $result

if ($JsonOutput) {
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $JsonOutput -Encoding UTF8
    Write-Host "Full JSON report written to $JsonOutput" -ForegroundColor Green
}
