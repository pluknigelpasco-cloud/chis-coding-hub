# CHIS Coding Hub Vercel App

A lightweight, stateless OAuth 2.0 and API proxy that bridges **ChatGPT Custom GPT Actions** to the **CHIS-Phoenix** Google Apps Script backend. This allows ChatGPT to securely query your medical coding database (ICD-10, RVS, Case Rates) on behalf of authorized users.

---

## ⚡ Integration Architecture

```
[ ChatGPT Custom GPT ] 
       │ (OAuth 2.0 Auth & API Request)
       ▼
[ Vercel OAuth Proxy ] (this repository)
       │ (Verifies Bearer Token & Forwards Request)
       ▼
[ Google Apps Script Web App ] (CHIS-Phoenix Sheets Backend)
```

---

## 🛠️ Step 1: Add API Helper to Google Apps Script

To enable the proxy to communicate with your Google Sheet database, you must update the `doGet(e)` function inside your bound Google Apps Script project.

1. Open your **CHIS Google Sheet** and go to **Extensions > Apps Script**.
2. Open **`Code.gs`** and replace the existing `doGet(e)` function (typically at the top of the file) with this implementation:

```javascript
function doGet(e) {
  // Check if request is an API request from the Vercel Proxy
  const action = e && e.parameter && e.parameter.action;
  
  if (action === "api") {
    const method = e.parameter.method;
    
    if (method === "login") {
      const username = e.parameter.username;
      const password = e.parameter.password;
      
      try {
        // Authenticate using existing CHIS User Database Auth
        const loginResult = CHISAuthV307.login({ username: username, password: password });
        if (loginResult && loginResult.sessionToken) {
          return ContentService.createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid credentials." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (method === "search") {
      const query = e.parameter.query || "";
      try {
        // Use existing searchDatabase helper inside Code.gs
        const searchResults = searchDatabase(query);
        return ContentService.createTextOutput(JSON.stringify(searchResults))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  // Fallback to standard CHIS UI rendering
  const requestedView = String(e && e.parameter && e.parameter.view || "").toLowerCase();
  if (requestedView === "transmittal") {
    return HtmlService.createTemplateFromFile("TransmittalModule")
      .evaluate()
      .setTitle("CHIS | Transmittal Monitoring")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
  }

  const template = HtmlService.createTemplateFromFile("index");
  const serviceUrl = ScriptApp.getService().getUrl() || "";
  template.transmittalModuleUrlJson = JSON.stringify(
    serviceUrl ? serviceUrl + "?view=transmittal" : "?view=transmittal"
  );
  return template.evaluate()
    .setTitle("CHIS | Community Health Information System")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
}
```

3. Save the project.
4. Click **Deploy > New deployment** (or **Manage deployments > Edit > New version**) and deploy the Web App.
5. **IMPORTANT:** Under "Who has access", select **Anyone** (this is necessary so Vercel can talk to it).
6. Copy the newly generated **Web App URL** (ends in `/exec`).

---

## 🚢 Step 2: Deploy this Proxy to Vercel

1. Create a new repository on your GitHub account (`pluknigelpasco-cloud` or similar) called `chis-coding-hub`.
2. Push this project folder to your repository:
   ```bash
   git add .
   git commit -m "Initial commit - CHIS ChatGPT Action OAuth Proxy"
   git branch -M main
   git remote add origin https://github.com/pluknigelpasco-cloud/chis-coding-hub.git
   git push -u origin main
   ```
3. Open your **Vercel Dashboard** (https://vercel.com) and import the repository.
4. Configure these **Environment Variables**:
   * `APPS_SCRIPT_URL`: Paste the Google Apps Script Web App URL copied in Step 1 (e.g. `https://script.google.com/macros/s/.../exec`).
   * `CLIENT_ID`: A secure string representing the OAuth Client ID (e.g., matching the one you will configure in ChatGPT: `oaiapp_QM1w4Kd95A8CeNCt2ONVREuZ`).
5. Click **Deploy**.

---

## 🤖 Step 3: Configure Custom GPT Action in ChatGPT

1. Go to **ChatGPT > Explore GPTs > Create a GPT**.
2. Under the **Configure** tab, scroll down and click **Create new action**.
3. Import the OpenAPI specification schema from `openapi.json` into the schema input box. Make sure to update the server URL if you use a custom domain.
4. Set **Authentication** to **OAuth**:
   * **Client ID**: Must match your `CLIENT_ID` environment variable (e.g., `oaiapp_QM1w4Kd95A8CeNCt2ONVREuZ`).
   * **Client Secret**: Enter any secure token (not verified strictly by our stateless flow but required by ChatGPT).
   * **Authorization URL**: `https://chis-coding-hub.cphbngl.chatgpt.site/oauth/authorize`
   * **Token URL**: `https://chis-coding-hub.cphbngl.chatgpt.site/oauth/token`
5. Save the Action and save your Custom GPT.
6. Test it! When you ask ChatGPT to search for a code, it will prompt you to log in, showing your custom branded login screen. Enter your CHIS username (`cphbngl`) and password to authenticate.
