# GitHub setup

```bash
cd AquaGuard-AI
git init
git add .
git commit -m "AquaGuard AI: standalone HTML application"
git branch -M main
```
Create an empty repository on github.com (no README/licence), then:
```bash
git remote add origin https://github.com/<your-username>/AquaGuard-AI.git
git push -u origin main
```
Optional: enable **GitHub Pages** (Settings -> Pages -> deploy from `main`, root) to host the app at `https://<your-username>.github.io/AquaGuard-AI/` - it is a static site and needs no build. Check `git status` first: no secrets, `node_modules` or personal data should be present. A default MIT `LICENSE` is included; change it if needed.
