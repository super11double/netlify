# Simple static file server (PowerShell HttpListener)
# Disables caching so the browser always loads the latest files
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Start()
$root = (Get-Location).Path
Write-Host "Server started: http://localhost:8000  root=$root"
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  # 每个请求单独 try-catch:任何一个请求处理失败都不能让整个服务器挂掉
  try {
    $req = $ctx.Request
    $res = $ctx.Response
    $path = $req.Url.AbsolutePath
    if ($path -eq "/") { $path = "/index.html" }
    # 中文文件名需要 URL 解码:HttpListener 的 AbsolutePath 不会自动解码 %XX 转义
    $path = [System.Uri]::UnescapeDataString($path)
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
      # 注意:必须先设置所有 Header/ContentType,最后才能设置 ContentLength64 并写流
      # 否则 .NET HttpListener 会抛 ProtocolViolationException,导致响应失败
      $res.ContentType = $ct
      $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
      $res.AddHeader("Pragma", "no-cache")
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: " + $path)
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    # 单个请求失败(客户端断开、写入异常等)只记日志,不影响后续请求
    Write-Host "REQ ERROR: $($_.Exception.Message)"
  } finally {
    try { $res.Close() } catch {}
  }
}
