$port = 8080
$root = "c:\Users\Elias Caetano\Documents\JC Food"
$logFile = Join-Path $root "server_debug.log"

function Log($msg) {
    $line = "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] $msg"
    Add-Content -Path $logFile -Value $line
}

Log "Iniciando script servidor_local.ps1..."

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".zip"  = "application/zip"
    ".txt"  = "text/plain; charset=utf-8"
    ".mp4"  = "video/mp4"
    ".webm" = "video/webm"
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$($port)/")
    $listener.Prefixes.Add("http://127.0.0.1:$($port)/")
    $listener.Start()
    Log "Listener iniciado com sucesso na porta $port."
} catch {
    Log "FALHA ao iniciar listener: $($_.Exception.ToString())"
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
        Log "Requisicao recebida: $urlPath"

        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $filePath = Join-Path $root "index.html"
        } else {
            $cleanRelative = $urlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $filePath = Join-Path $root $cleanRelative
            if (Test-Path $filePath -PathType Container) {
                $filePath = Join-Path $filePath "index.html"
            }
        }

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $mime
            
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            Log "Servido com sucesso: $filePath ($($bytes.Length) bytes)"
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.ContentLength64 = $msg.Length
            $response.ContentType = "text/plain; charset=utf-8"
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Log "Arquivo nao encontrado: $filePath"
        }
        $response.OutputStream.Close()
    } catch {
        Log "Erro no loop de atendimento: $($_.Exception.ToString())"
    }
}

Log "Listener finalizado. IsListening = $($listener.IsListening)"
