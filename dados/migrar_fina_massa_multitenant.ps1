$backup = Get-Content -Raw -Encoding UTF8 'dados\backup_antes_multitenant.json' | ConvertFrom-Json

$finaMassaTenant = [ordered]@{
    info = [ordered]@{
        name = "Fina Massa Pizzaria"
        slug = "fina-massa"
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    menu = $backup.menu
    customers = $backup.customers
    campaigns = $backup.campaigns
    tables = $backup.tables
    settings = $backup.settings
    status = [ordered]@{
        isOpen = $true
    }
}

$tenantJson = $finaMassaTenant | ConvertTo-Json -Depth 100

$scratchPath = "C:\Users\Elias Caetano\.gemini\antigravity\brain\69022b9a-b0af-47ed-82ba-df73a6763c44\scratch\fina_massa_tenant_nobom.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($scratchPath, $tenantJson, $utf8NoBom)

Write-Host "Arquivo de migração gerado em: $scratchPath (Tamanho: $((Get-Item $scratchPath).Length) bytes)"
Write-Host "Enviando para Firebase via Invoke-RestMethod..."

$uri = "https://fina-massa-952b1-default-rtdb.firebaseio.com/companies/fina-massa.json"
$res = Invoke-RestMethod -Uri $uri -Method Put -InFile $scratchPath -ContentType "application/json; charset=utf-8"

Write-Host "Sucesso! Nó companies/fina-massa provisionado no Firebase:"
Write-Host "Keys criadas:" ($res.psobject.properties.Name -join ', ')
