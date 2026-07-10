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

## 3. GitHub Pages 켜기 (한 번만) — Actions 없이 가능

1. 저장소 → **Settings** (설정)
2. 왼쪽 메뉴에서 **Pages** 클릭  
   직접 링크: https://github.com/escescesc1234-cmyk/idle-clicker/settings/pages
3. **Build and deployment** → **Source** 를 **Deploy from a branch** 로 선택
4. **Branch** → `main` / `/(root)` 선택 → **Save**

1~2분 후 사이트가 열립니다.

> Actions 탭이 안 보여도 이 방법이면 됩니다.

### (선택) Actions로 배포하고 싶다면
- Actions 탭: https://github.com/escescesc1234-cmyk/idle-clicker/actions
- Settings → Actions → General 에서 Actions 사용이 꺼져 있으면 켜기
- Pages Source를 **GitHub Actions** 로 선택

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
