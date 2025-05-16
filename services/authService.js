const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

async function getAccessToken(logError) {
    const tenantId = process.env.MS365_TENANT_ID;
    const clientId = process.env.MS365_CLIENT_ID;
    const clientSecret = process.env.MS365_CLIENT_SECRET;

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'client_credentials');

    const response = await fetch(url, {
        method: 'POST',
        body: params
    });

    const data = await response.json();

    if (!response.ok) {
        logError(`[Error] No se pudo obtener el token: ${data.error_description || response.statusText}`);
        console.error(`[Error] No se pudo obtener el token: ${data.error_description || response.statusText}`);
        throw new Error(`Token error: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

module.exports = { getAccessToken };