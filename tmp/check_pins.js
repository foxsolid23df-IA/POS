const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Try to read .env file
const envFile = fs.readFileSync('c:/POS/frontend/.env', 'utf8');
const env = dotenv.parse(envFile);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPins() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, store_name, full_name, role, master_pin');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log('Profiles currently in DB:');
    console.log(JSON.stringify(data, null, 2));
}

checkPins();
