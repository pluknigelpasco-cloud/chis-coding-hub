const https = require('https');
const url = require('url');

// Simple in-memory or helper to verify logins via Google Apps Script Web App
function checkAppsScriptLogin(appsScriptUrl, username, password) {
  return new Promise((resolve, reject) => {
    if (!appsScriptUrl) {
      return reject(new Error('APPS_SCRIPT_URL environment variable is not configured.'));
    }

    // Call Google Apps Script with action=login
    const targetUrl = `${appsScriptUrl}?action=api&method=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    
    https.get(targetUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('Invalid JSON response from Google Apps Script.'));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  const method = req.method;
  
  // Extract query parameters
  const query = req.query || {};
  const response_type = query.response_type || req.body?.response_type;
  const client_id = query.client_id || req.body?.client_id;
  const redirect_uri = query.redirect_uri || req.body?.redirect_uri;
  const state = query.state || req.body?.state;
  const errorMsg = query.error || '';

  // Get configuration from Env
  const configClientId = process.env.CLIENT_ID || 'oaiapp_QM1w4Kd95A8CeNCt2ONVREuZ';
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (method === 'GET') {
    // Render institutional glass login page
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CHIS Coding Hub | Authorize ChatGPT</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #0056b3;
            --primary-dark: #003d80;
            --primary-light: #e6f0ff;
            --glass-bg: rgba(255, 255, 255, 0.85);
            --glass-border: rgba(255, 255, 255, 0.4);
            --text-main: #1e293b;
            --text-muted: #64748b;
        }

        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0369a1 100%);
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }

        .auth-container {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            width: 100%;
            max-width: 440px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .brand-header {
            margin-bottom: 30px;
        }

        .brand-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 26px;
            margin: 0 0 8px 0;
            color: #0f172a;
        }

        .subtitle {
            font-size: 14px;
            color: var(--text-muted);
            margin: 0;
        }

        .client-info {
            background: rgba(2, 132, 199, 0.1);
            border: 1px solid rgba(2, 132, 199, 0.2);
            padding: 12px;
            border-radius: 12px;
            font-size: 13px;
            color: #0369a1;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .error-banner {
            background: #ffe4e6;
            border: 1px solid #fecdd3;
            color: #be123c;
            padding: 12px;
            border-radius: 12px;
            font-size: 13px;
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group {
            text-align: left;
            margin-bottom: 18px;
            position: relative;
        }

        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 6px;
            color: #334155;
        }

        .input-wrapper {
            position: relative;
        }

        input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 15px;
            box-sizing: border-box;
            background: rgba(255, 255, 255, 0.9);
            transition: all 0.2s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(0, 86, 179, 0.15);
        }

        .btn-submit {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
            transition: all 0.2s ease;
            margin-top: 10px;
        }

        .btn-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
        }

        .footer {
            margin-top: 30px;
            font-size: 11px;
            color: var(--text-muted);
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="brand-header">
            <div class="brand-icon">🏥</div>
            <h1>CHIS Coding Hub</h1>
            <p class="subtitle">Secure Identity Authorization</p>
        </div>

        <div class="client-info">
            <span>✦</span>
            <span>Authorizing <strong>ChatGPT Actions</strong></span>
        </div>

        ${errorMsg ? `<div class="error-banner">❌ ${errorMsg}</div>` : ''}

        <form method="POST">
            <!-- Hidden OAuth States -->
            <input type="hidden" name="response_type" value="${response_type || ''}">
            <input type="hidden" name="client_id" value="${client_id || ''}">
            <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}">
            <input type="hidden" name="state" value="${state || ''}">

            <div class="form-group">
                <label for="username">CHIS Admin/Staff Username</label>
                <div class="input-wrapper">
                    <input type="text" id="username" name="username" placeholder="e.g. cphbngl" required autofocus>
                </div>
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <div class="input-wrapper">
                    <input type="password" id="password" name="password" placeholder="••••••••" required>
                </div>
            </div>

            <button type="submit" class="btn-submit">Approve & Connect</button>
        </form>

        <div class="footer">
            Cebu Provincial Hospital - Balamban<br>
            Community Health Information System · v3.2.0 Phoenix
        </div>
    </div>
</body>
</html>
    `);
    return;
  }

  if (method === 'POST') {
    // Form is submitted, process authentication
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const params = new URLSearchParams(body);
      const username = params.get('username') || '';
      const password = params.get('password') || '';
      
      const formResponseType = params.get('response_type') || response_type;
      const formClientId = params.get('client_id') || client_id;
      const formRedirectUri = params.get('redirect_uri') || redirect_uri;
      const formState = params.get('state') || state;

      if (!formRedirectUri) {
        res.status(400).send('Missing redirect_uri parameter.');
        return;
      }

      try {
        // Validate credentials with Google Apps Script
        const authResult = await checkAppsScriptLogin(appsScriptUrl, username, password);
        
        if (authResult && authResult.success) {
          // Credentials valid! Generate standard authorization code
          const authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          
          // Redirect browser back to ChatGPT callback
          const redirectUrl = `${formRedirectUri}?code=${authCode}&state=${encodeURIComponent(formState || '')}`;
          res.writeHead(302, { Location: redirectUrl });
          res.end();
        } else {
          // Authentication failed
          const msg = authResult?.message || 'Invalid username or password.';
          res.writeHead(302, { 
            Location: `/oauth/authorize?response_type=${formResponseType}&client_id=${formClientId}&redirect_uri=${encodeURIComponent(formRedirectUri)}&state=${encodeURIComponent(formState)}&error=${encodeURIComponent(msg)}` 
          });
          res.end();
        }
      } catch (err) {
        // Log/Report error
        res.writeHead(302, { 
          Location: `/oauth/authorize?response_type=${formResponseType}&client_id=${formClientId}&redirect_uri=${encodeURIComponent(formRedirectUri)}&state=${encodeURIComponent(formState)}&error=${encodeURIComponent(err.message)}` 
        });
        res.end();
      }
    });
  }
};
