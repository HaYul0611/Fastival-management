# 1. 최신 작업 소스 코드를 festival 폴더로 복사 (빌드 및 임시 파일 제외)
Copy-Item -Path src, gradle, build.gradle, settings.gradle, gradlew, gradlew.bat, uploads -Destination festival -Recurse -Force
Copy-Item -Path .gitignore -Destination festival\ -Force


# 2. festival 폴더로 이동
cd festival

# 3. Git 커밋 및 푸시 진행
git add .
git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push origin main



# 4. 원래 폴더로 복귀
cd ..
Write-Output "🎉 Hugging Face로 최신 코드가 복사 및 푸시되었습니다! 배포 로그를 확인하세요."
