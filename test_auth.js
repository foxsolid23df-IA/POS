const authUrl = 'https://authcli.stagefacturador.com/connect/token';

async function test1() {
  const authBody = new URLSearchParams({
    grant_type: 'password',
    username: 'demodemo',
    password: 'Dotnet_1',
    scope: 'api1'
  });

  const basicAuth = btoa('autofacturador:secret');
  console.log("TEST 1 - Only Basic Auth (no client_id in body)");
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: authBody,
  });
  console.log(await res.text());
}

async function test2() {
  const authBody = new URLSearchParams({
    grant_type: 'password',
    username: 'demodemo',
    password: 'Dotnet_1',
    client_id: 'autofacturador',
    client_secret: 'secret',
    scope: 'api1'
  });

  console.log("\nTEST 2 - Only Body (no Basic Auth header)");
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: authBody,
  });
  console.log(await res.text());
}

async function test3() {
    console.log("\nTEST 3 - Original (Both Body and Basic Auth)");
    const authBody = new URLSearchParams({
      grant_type: 'password',
      username: 'GOYA780416GM0',
      password: '20b03da6247eb1ba4a04c3bda7285c94',
      client_id: 'autofacturador',
      client_secret: 'secret',
      scope: 'api1',
    });
  
    const basicAuth = btoa('autofacturador:secret');
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: authBody,
    });
    console.log(await res.text());
}

async function run() {
    await test1();
    await test2();
    await test3();
}
run();
