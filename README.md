# Callwell website

Marketing site for Callwell, an AI phone receptionist for San Diego home service businesses.
Plain HTML, CSS, and JavaScript. No build step: the files in this folder ARE the website.

## Files
| File | What it does |
|---|---|
| `index.html` | The whole landing page (all text lives here) |
| `css/styles.css` | All styling. Colors are variables at the top |
| `js/config.js` | **Edit this** for phone number, booking link, email, prices |
| `js/main.js` | Fills in config values, calculator, loads animations and 3D |
| `js/hero-scene.js` | The Three.js glowing sphere |
| `privacy.html`, `terms.html` | Draft legal pages, need a lawyer |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Preview on your computer
ES modules don't work from `file://`, so run a tiny local server in this folder:
```
python3 -m http.server 8080
```
Then open http://localhost:8080

## Deploy to GitHub Pages
1. Push this folder to the `main` branch of your GitHub repo.
2. On GitHub: repo > **Settings** > **Pages**.
3. Under **Build and deployment**, Source = **Deploy from a branch**.
4. Branch = `main`, folder = `/ (root)`, click **Save**.
5. Wait 1 to 2 minutes. Your site is at `https://<your-username>.github.io/<repo-name>/`.
6. Every push to `main` redeploys automatically.

Custom domain (optional): Settings > Pages > Custom domain, then add the DNS records GitHub shows you at your domain registrar. Tick **Enforce HTTPS**.
