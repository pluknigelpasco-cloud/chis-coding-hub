module.exports = async (req, res) => {
  const method = req.method;

  if (method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Parse application/x-www-form-urlencoded body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const params = new URLSearchParams(body);
    const grant_type = params.get('grant_type');
    const code = params.get('code');
    const client_id = params.get('client_id');
    const client_secret = params.get('client_secret');

    // Respond with a stateless bearer access token
    const accessToken = 'chis_token_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      token_type: 'Bearer',
      access_token: accessToken,
      expires_in: 86400 // 24 hours
    });
  });
};
