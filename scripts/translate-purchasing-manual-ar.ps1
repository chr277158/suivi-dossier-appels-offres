$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'docs\Manuel Achats GCT 29-12-2022.docx'
$output = Join-Path $PSScriptRoot 'purchasing-manual-ar.json'
$cachePath = Join-Path $env:TEMP 'gct-purchasing-manual-fr-ar-cache.json'
$endpoint = 'https://translate.googleapis.com/translate_a/single'
$maxText = 1050
$xmlNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function Write-Utf8Json($path, $value) {
  $json = ConvertTo-Json -InputObject $value -Depth 8 -Compress
  [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Split-ManualText([string]$text, [int]$limit) {
  $parts = [System.Collections.Generic.List[string]]::new()
  $remaining = $text
  while ($remaining.Length -gt $limit) {
    $end = $limit
    $boundary = $remaining.LastIndexOf(' ', $end)
    if ($boundary -gt ($limit / 2)) { $end = $boundary }
    $parts.Add($remaining.Substring(0, $end).Trim())
    $remaining = $remaining.Substring($end).Trim()
  }
  if ($remaining) { $parts.Add($remaining) }
  return $parts.ToArray()
}

function Invoke-TranslateBatch($items) {
  $queryParts = foreach ($item in $items) {
    $marker = ([int]$item.SegmentId).ToString('D6')
    "ZXQ${marker}QXZ $($item.Text) ZXE${marker}XZ"
  }
  $query = [Uri]::EscapeDataString(($queryParts -join "`n"))
  $uri = "${endpoint}?client=gtx&sl=fr&tl=ar&dt=t&q=$query"
  for ($attempt = 0; $attempt -lt 5; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 45
      break
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds (5 * ($attempt + 1))
    }
  }
  $translated = ($response.value[0] | ForEach-Object { [string]$_.Item(0) }) -join ''
  $matches = [regex]::Matches($translated, 'ZXQ(\d{6})QXZ\s*(.*?)\s*ZXE\1XZ', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($matches.Count -ne $items.Count) { throw "Marqueurs perdus : $($matches.Count)/$($items.Count)." }
  $result = @{}
  foreach ($match in $matches) { $result[[int]$match.Groups[1].Value] = $match.Groups[2].Value.Trim() }
  return $result
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($source)
try {
  $entry = $archive.GetEntry('word/document.xml')
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }

$manager = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
$manager.AddNamespace('w', $xmlNs)
$paragraphNodes = $document.SelectNodes('//w:body//w:p', $manager)
$texts = [System.Collections.Generic.List[string]]::new()
foreach ($paragraph in $paragraphNodes) {
  $texts.Add((($paragraph.SelectNodes('.//w:t', $manager) | ForEach-Object { $_.InnerText }) -join ''))
}

$translations = [string[]]::new($texts.Count)
$cache = @{}
if (Test-Path -LiteralPath $cachePath) {
  $cacheObject = Get-Content -LiteralPath $cachePath -Raw -Encoding utf8 | ConvertFrom-Json
  foreach ($property in $cacheObject.PSObject.Properties) { $cache[$property.Name] = [string]$property.Value }
}
$partsByParagraph = @{}
$batches = [System.Collections.Generic.List[object]]::new()
$batch = [System.Collections.Generic.List[object]]::new()
$batchLength = 0
$segmentId = 0
for ($paragraphIndex = 0; $paragraphIndex -lt $texts.Count; $paragraphIndex++) {
  $text = $texts[$paragraphIndex]
  if (-not $text.Trim()) { $translations[$paragraphIndex] = ''; continue }
  if ($cache.ContainsKey([string]$paragraphIndex)) { $translations[$paragraphIndex] = [string]$cache[[string]$paragraphIndex]; continue }
  $parts = Split-ManualText $text $maxText
  $partsByParagraph[$paragraphIndex] = $parts.Count
  for ($partIndex = 0; $partIndex -lt $parts.Count; $partIndex++) {
    $part = $parts[$partIndex]
    if ($batch.Count -gt 0 -and ($batchLength + $part.Length + 30) -gt $maxText) {
      $batches.Add($batch.ToArray())
      $batch = [System.Collections.Generic.List[object]]::new()
      $batchLength = 0
    }
    $batch.Add([pscustomobject]@{ SegmentId = $segmentId; ParagraphIndex = $paragraphIndex; PartIndex = $partIndex; Text = $part })
    $batchLength += $part.Length + 30
    $segmentId++
  }
}
if ($batch.Count -gt 0) { $batches.Add($batch.ToArray()) }

Write-Output "Paragraphes : $($texts.Count); lots à traduire : $($batches.Count)"
$partial = @{}
for ($batchIndex = 0; $batchIndex -lt $batches.Count; $batchIndex++) {
  $translatedParts = Invoke-TranslateBatch $batches[$batchIndex]
  foreach ($item in $batches[$batchIndex]) {
    if (-not $partial.ContainsKey($item.ParagraphIndex)) { $partial[$item.ParagraphIndex] = @{} }
    $partial[$item.ParagraphIndex][$item.PartIndex] = $translatedParts[[int]$item.SegmentId]
  }
  foreach ($paragraphIndex in @($batches[$batchIndex] | ForEach-Object { $_.ParagraphIndex } | Select-Object -Unique)) {
    if ($partial[$paragraphIndex].Count -eq $partsByParagraph[$paragraphIndex]) {
      $pieces = for ($part = 0; $part -lt $partsByParagraph[$paragraphIndex]; $part++) { $partial[$paragraphIndex][$part] }
      $translations[$paragraphIndex] = $pieces -join ' '
      $cache[[string]$paragraphIndex] = $translations[$paragraphIndex]
    }
  }
  if ((($batchIndex + 1) % 10) -eq 0 -or ($batchIndex + 1) -eq $batches.Count) {
    Write-Utf8Json $cachePath $cache
    Write-Output "Lots terminés : $($batchIndex + 1)/$($batches.Count)"
  }
  Start-Sleep -Milliseconds 850
}

$missing = for ($i = 0; $i -lt $texts.Count; $i++) { if ($texts[$i].Trim() -and -not $translations[$i]) { $i } }
if ($missing.Count -gt 0) { throw "Traduction manquante pour $($missing.Count) paragraphes; cache conservé dans $cachePath." }
Write-Utf8Json $output $translations
Write-Output "Traduction écrite dans $output"
if (Test-Path -LiteralPath $cachePath) { Remove-Item -LiteralPath $cachePath }
