const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    res.status(500).json({ error: 'APPS_SCRIPT_URL environment variable is not configured.' });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    // Send request to Apps Script URL
    sendPostRequest(appsScriptUrl, body)
      .then(response => {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(response);
      })
      .catch(err => {
        res.status(502).json({ error: err.message });
      });
  });
};

function sendPostRequest(targetUrl, postData) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(targetUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      // Handle Google Apps Script 302 redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectLocation = res.headers.location;
        if (redirectLocation) {
          sendPostRequest(redirectLocation, postData)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        resolve(responseBody);
      });
    });

    req.on('error', (err) => {
      reject(new Error('Network error calling Apps Script: ' + err.message));
    });

    req.write(postData);
    req.end();
  });
}
