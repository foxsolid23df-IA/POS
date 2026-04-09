

const SUPABASE_URL = "https://qqvjhitxehlqyvawnept.supabase.co/functions/v1/timbrar";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdmpoaXR4ZWhscXl2YXduZXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDczNDksImV4cCI6MjA4NDE4MzM0OX0.fqzRsPb883Bn9Ob1ktZziyZtA4MUcTgtfaon6VoszqA";

const body = {
  ticket_uuid: "f153b1c0-6a73-43ef-8788-58a90bcb3c38",
  rfc: "XAXX010101000",
  razon_social: "PUBLICO EN GENERAL",
  codigo_postal: "07840",
  regimen_fiscal: "616",
  uso_cfdi: "S01",
  email: "test@example.com"
};

async function test() {
  console.log("Testing Edge Function...");
  const res = await fetch(SUPABASE_URL, {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify(body)
  });
  
  console.log("Status:", res.status);
  const data = await res.text();
  console.log("Response:", data);
}

test();
