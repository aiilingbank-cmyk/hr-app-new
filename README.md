# HR Mini App — Fresh Full
- Vite base = `./` (relative) → ใช้ได้กับทุกชื่อรีโป
- ดีพลอยด้วย **GitHub Actions** (ไม่ต้องมี gh-pages branch)
- ฟีเจอร์: ลงเวลา (กล้อง+พิกัด), ยื่นลา, คิดชั่วโมง, แดชบอร์ด + CSV

## Deploy
1) สร้างรีโปใหม่ (เช่น `hr-mini-app-new`) แล้วอัปโหลดไฟล์ทั้งหมดขึ้นสาขา `main`
2) Settings → Pages → Source = **GitHub Actions**
3) Actions → Run workflow **Deploy Vite app to GitHub Pages**
4) เปิด `https://<username>.github.io/<repo-name>/`

> ถ้าเปิดแล้วขาว ให้เปิดแบบ Incognito หรือเติม `?v=1` กันแคช
