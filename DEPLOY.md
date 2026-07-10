# GitHub에 올리기 (한 번만)

## 1. GitHub에서 저장소 만들기
1. https://github.com/new?name=idle-clicker&visibility=public 접속
2. **Public** 선택
3. **Add a README** / **.gitignore** / **license** 는 체크하지 마세요 (비어 있는 저장소)
4. **Create repository** 클릭

## 2. 코드 push
PowerShell에서:

```powershell
cd C:\Users\esces\idle-clicker
git push -u origin main
```

브라우저 로그인 창이 뜨면 GitHub 계정으로 승인하세요.

## 3. GitHub Pages 켜기 (한 번만)
1. 저장소 → **Settings** → **Pages**
2. **Build and deployment** → Source: **GitHub Actions**
3. **Actions** 탭에서 `Deploy GitHub Pages` 워크플로가 완료될 때까지 대기

## 플레이 주소
https://escescesc1234-cmyk.github.io/idle-clicker/

## 이후 업데이트
코드 수정 후:

```powershell
cd C:\Users\esces\idle-clicker
git add -A
git commit -m "업데이트 내용"
git push
```

push하면 자동으로 사이트가 갱신됩니다.
