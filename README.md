# CHIS Coding Hub Standalone Vercel App

A production-ready standalone web application frontend for **CHIS-Phoenix**, compiled and deployed on Vercel.

It inlines App Script includes, polyfills the `google.script` environment (including `google.script.run`, `url.getLocation`, and `history.replace`), and proxies backend calls to your Google Sheet database.

---

## ⚡ Integration Architecture

```
[ Standalone Browser App ] (Vercel static index.html)
       │ (Intercepts google.script.run and makes fetch)
       ▼
[ Vercel API Proxy ] (api/proxy.js)
       │ (Redirects payload via POST to Apps Script)
       ▼
[ Google Apps Script Web App ] (doPost handler in Code.gs)
```

---

## 🛠️ Step 1: Add API Handlers to Google Apps Script

To process the backend executions forwarded by Vercel, you must add both a `doPost(e)` handler and update `doGet(e)` inside your bound Google Apps Script project.

1. Open your **CHIS Google Sheet** and go to **Extensions > Apps Script**.
2. Open **`Code.gs`** and paste this `doPost(e)` function at the bottom:

```javascript
/**
 * Processes incoming POST requests from the Vercel proxy.
 * Dynamically calls the corresponding Apps Script functions.
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const args = postData.arguments || [];
    
    // Call the corresponding function dynamically
    if (typeof this[action] === "function") {
      const result = this[action].apply(null, args);
      return ContentService.createTextOutput(JSON.stringify({ result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ error: "Function not found on server: " + action }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Save the project.
4. Click **Deploy > New deployment** (or **Manage deployments > Edit > New version**) and deploy the Web App.
5. **IMPORTANT:** Under "Who has access", select **Anyone** (this is necessary so Vercel can talk to it).
6. Copy the newly generated **Web App URL** (ends in `/exec`).

---

## 🚢 Step 2: Push to GitHub & Deploy on Vercel

1. Create a new repository on your GitHub account (`pluknigelpasco-cloud` or similar) called `chis-coding-hub`.
2. Push this project folder to your repository:
   ```bash
   git add .
   git commit -m "Configure standalone CHIS-Phoenix app on Vercel"
   git branch -M main
   git remote add origin https://github.com/pluknigelpasco-cloud/chis-coding-hub.git
   git push -u origin main
   ```
3. Open your **Vercel Dashboard** (https://vercel.com) and import the repository.
4. Vercel will automatically run the build script `node build.js` to compile the bundle into `public/`.
5. Configure the **Environment Variable**:
   * `APPS_SCRIPT_URL`: Paste the Google Apps Script Web App URL copied in Step 1 (e.g. `https://script.google.com/macros/s/.../exec`).
6. Click **Deploy**.
