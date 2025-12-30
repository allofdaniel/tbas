# 로컬에서 APK 빌드 및 GitHub에 업로드하는 스크립트
# 사용법: .\build-apk-local.ps1

Write-Host "=== RKPU Viewer APK 빌드 ===" -ForegroundColor Cyan

# 1. 웹 앱 빌드
Write-Host "`n[1/5] 웹 앱 빌드중..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "빌드 실패!" -ForegroundColor Red; exit 1 }

# 2. Capacitor 설치 확인
Write-Host "`n[2/5] Capacitor 확인..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules/@capacitor/core")) {
    npm install @capacitor/core @capacitor/cli @capacitor/android
}

# 3. Android 프로젝트 초기화
Write-Host "`n[3/5] Android 프로젝트 설정..." -ForegroundColor Yellow
if (-not (Test-Path "android")) {
    npx cap add android
}
npx cap sync android

# 4. APK 빌드
Write-Host "`n[4/5] APK 빌드중..." -ForegroundColor Yellow
Push-Location android
.\gradlew.bat assembleDebug --build-cache --parallel
$buildResult = $LASTEXITCODE
Pop-Location

if ($buildResult -ne 0) {
    Write-Host "APK 빌드 실패!" -ForegroundColor Red
    exit 1
}

# 5. APK 복사
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$outputPath = "rkpu-viewer.apk"
if (Test-Path $apkPath) {
    Copy-Item $apkPath $outputPath -Force
    Write-Host "`n=== 빌드 완료! ===" -ForegroundColor Green
    Write-Host "APK 파일: $outputPath" -ForegroundColor Cyan
    Write-Host "크기: $((Get-Item $outputPath).Length / 1MB) MB" -ForegroundColor Cyan

    # GitHub Release 생성 여부 확인
    $upload = Read-Host "`nGitHub Release로 업로드할까요? (y/n)"
    if ($upload -eq "y") {
        $version = Read-Host "버전 입력 (예: v1.0.0)"
        git tag $version
        git push origin $version
        gh release create $version $outputPath --title "RKPU Viewer $version" --notes "자동 빌드된 APK"
        Write-Host "GitHub Release 완료!" -ForegroundColor Green
    }
} else {
    Write-Host "APK 파일을 찾을 수 없습니다!" -ForegroundColor Red
}
