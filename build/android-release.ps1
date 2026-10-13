$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousJavaHome = $env:JAVA_HOME
$previousLocation = Get-Location
function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falha em $Command (codigo $LASTEXITCODE). APK de distribuicao nao atualizado." }
}
try {
    Set-Location -LiteralPath $projectRoot
    foreach ($required in @('node_modules', 'android/keystore.properties', 'android/app/google-services.json', 'public/assets/js/firebase-config.js')) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Arquivo ou pasta necessaria ausente: $required" }
    }
    $config = Get-Content -Raw -LiteralPath 'capacitor.config.json' | ConvertFrom-Json
    $serverUrl = [Uri]$config.server.url
    if (-not $serverUrl.IsAbsoluteUri -or $serverUrl.Scheme -ne 'https' -or $serverUrl.IsLoopback -or $config.server.cleartext) {
        throw 'O release exige uma URL HTTPS de producao em capacitor.config.json.'
    }
    $sdkPath = $env:ANDROID_HOME
    if (-not $sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
    if (-not $sdkPath) { $sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    $buildTools = Get-ChildItem -LiteralPath (Join-Path $sdkPath 'build-tools') -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if (-not $buildTools) { throw 'Android SDK build-tools nao encontrado. Configure ANDROID_HOME.' }
    $apkSigner = Join-Path $buildTools.FullName 'apksigner.bat'
    $aapt = Join-Path $buildTools.FullName 'aapt.exe'
    foreach ($tool in @($apkSigner,$aapt)) {
        if (-not (Test-Path -LiteralPath $tool)) { throw "Ferramenta ausente: $tool" }
    }
    $studioJdk = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
    if ($env:ANDROID_JAVA_HOME) {
        $env:JAVA_HOME = $env:ANDROID_JAVA_HOME
    } elseif (Test-Path -LiteralPath (Join-Path $studioJdk 'bin\java.exe')) {
        $env:JAVA_HOME = $studioJdk
    }
    if (-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        throw 'Configure JAVA_HOME para o JDK do Android Studio.'
    }
    $tests = @(Get-ChildItem -Path 'tests/*.test.js' -File -ErrorAction SilentlyContinue)
    if ($tests.Count) {
        Write-Host 'Executando testes locais...'
        Invoke-Checked 'node' (@('--test') + @($tests.FullName))
    } else {
        Write-Host 'Sem testes locais neste checkout; a verificacao automatizada do APK continua.'
    }
    Invoke-Checked 'node' @('node_modules/esbuild/bin/esbuild','build/capacitor-google-auth-bridge.js','--bundle','--outfile=public/assets/js/capacitor-google-auth-bridge.js','--format=iife')
    Invoke-Checked 'node' @('node_modules/@capacitor/cli/bin/capacitor','sync','android')
    Set-Location -LiteralPath (Join-Path $projectRoot 'android')
    Invoke-Checked '.\gradlew.bat' @(':app:assembleRelease','--console=plain')
    Set-Location -LiteralPath $projectRoot
    $releaseDir = Join-Path $projectRoot 'android/app/build/outputs/apk/release'
    $apk = Join-Path $releaseDir 'app-release.apk'
    if (-not (Test-Path -LiteralPath $apk)) { throw 'APK release assinado nao foi gerado.' }
    $metadata = Get-Content -Raw -LiteralPath (Join-Path $releaseDir 'output-metadata.json') | ConvertFrom-Json
    $release = @($metadata.elements)[0]
    if ($metadata.variantName -ne 'release' -or $release.outputFile -ne 'app-release.apk' -or $release.versionName -match 'local|debug') {
        throw 'Metadados inesperados para um APK de producao.'
    }
    Invoke-Checked $apkSigner @('verify',$apk)
    $badging = & $aapt dump badging $apk
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel inspecionar o manifesto do APK.' }
    if (($badging -join "`n") -match 'application-debuggable') { throw 'APK de producao marcado como debuggable.' }
    $packageLine = $badging | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
    if (-not $packageLine.Contains("versionCode='$($release.versionCode)'") -or -not $packageLine.Contains("versionName='$($release.versionName)'")) {
        throw 'Versao do APK difere dos metadados do build.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($apk)
    try {
        $entry = $zip.GetEntry('assets/capacitor.config.json')
        if (-not $entry) { throw 'Configuracao Capacitor ausente no APK.' }
        $reader = New-Object IO.StreamReader($entry.Open())
        try { $packed = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        if ($packed.server.url -ne $config.server.url -or $packed.server.cleartext -or $packed.appId -ne $config.appId) {
            throw 'O APK nao corresponde a configuracao de producao.'
        }
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match '(?i)(firebase-admin-key\.json|keystore\.properties|\.(db|sqlite|jks|keystore)$|assets/public/(tests|docs)/)') {
                throw 'Arquivo privado ou de teste encontrado no APK. Distribuicao interrompida.'
            }
        }
    } finally { $zip.Dispose() }
    $destination = Join-Path $releaseDir 'biblioteca-digital.apk'
    Copy-Item -LiteralPath $apk -Destination $destination -Force
    $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath "$destination.sha256" -Value "$hash  biblioteca-digital.apk" -Encoding ASCII
    Write-Host "`nAPK de producao validado: $destination"
    Write-Host "Versao: $($release.versionName) | Codigo: $($release.versionCode)"
    Write-Host "SHA256: $hash"
    Write-Host 'Nenhum commit, push ou publicacao foi realizado.'
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    $env:JAVA_HOME = $previousJavaHome
    Set-Location -LiteralPath $previousLocation.Path
}
