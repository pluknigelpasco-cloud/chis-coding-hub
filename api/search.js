const https = require('https');

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  
  // Validate Bearer Token
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
    return;
  }

  const query = req.query || {};
  const searchTerm = query.q || query.query || '';
  
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    res.status(500).json({ error: 'APPS_SCRIPT_URL environment variable is not configured.' });
    return;
  }

  // Construct target URL for search database function
  const targetUrl = `${appsScriptUrl}?action=api&method=search&query=${encodeURIComponent(searchTerm)}`;

  https.get(targetUrl, (resStream) => {
    let data = '';
    resStream.on('data', (chunk) => { data += chunk; });
    resStream.on('end', () => {
      try {
        const result = JSON.parse(data);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(result);
      } catch (e) {
        // If it's HTML (Google login redirect, etc.)
        if (data.includes('doctype') || data.includes('html')) {
          res.status(502).json({ error: 'Received HTML instead of JSON. Ensure your Apps Script Web App is deployed with Access: "Anyone" (even anonymous).' });
        } else {
          res.status(502).json({ error: 'Failed to parse JSON response from Apps Script backend.', rawResponse: data });
        }
      }
    });
  }).on('error', (err) => {
    res.status(502).json({ error: 'Network error communicating with Apps Script.', details: err.message });
  });
};
