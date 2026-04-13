const url = 'https://authcli.stagefacturador.com/connect/token';
const clients = ['autofacturador', 'api', 'web', 'postman', 'swagger', 'client', 'ro.client', 'app', 'facturador', 'facturador.api', 'swaggerui', 'admin', 'stage', 'GOYA780416GM0'];

async function testClient(clientId) {
  const body = new URLSearchParams({
    grant_type: 'password',
    username: 'GOYA780416GM0',
    password: '20b03da6247eb1ba4a04c3bda7285c94',
    scope: 'api1',
  });
  
  const basicAuth = btoa(`${clientId}:secret`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: body.toString()
  });
  
  const data = await res.json();
  console.log(`[${clientId}] -> ${res.status} : ${JSON.stringify(data)}`);
}

async function run() {
  for (const client of clients) {
    await testClient(client);
  }
}
run();
