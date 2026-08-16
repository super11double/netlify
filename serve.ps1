# Simple static file server (PowerShell HttpListener)
# Disables caching so the browser always loads the latest files
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Start()
$root = (Get-Location).Path
Write-Host "Server started: http://localhost:8000  root=$root"
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $req = $ctx.Request
  $res = $ctx.Response
  $path = $req.Url.AbsolutePath
  if ($path -eq "/") { $path = "/index.html" }
  $rel = $path -replace "^/","" -replace "/","\"
  $filePath = Join-Path $root $rel
  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $ct = switch ($ext) {
      ".html" { "text/html; charset=utf-8" }
      ".js"   { "application/javascript; charset=utf-8" }
      ".css"  { "text/css; charset=utf-8" }
      ".png"  { "image/png" }
      ".jpg"  { "image/jpeg" }
      ".jpeg" { "image/jpeg" }
      default { "application/octet-stream" }
    }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $res.ContentType = $ct
    $res.ContentLength64 = $bytes.Length
    $res.Headers.Set("Cache-Control", "no-cache, no-store, must-revalidate")
    $res.Headers.Set("Pragma", "no-cache")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: " + $path)
    $res.OutputStream.Write($msg, 0, $msg.Length)
  }
  $res.Close()
}
