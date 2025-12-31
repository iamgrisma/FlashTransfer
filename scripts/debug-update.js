const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

async function test() {
    console.log('--- DEBUG UPDATE ---');
    // Generate valid 5-char code
    const code = 'D' + Math.floor(1000 + Math.random() * 9000); // D1000-D9999

    console.log(`1. Inserting code: "${code}"...`);
    const { data: inserted, error: iErr } = await supabase
        .from('fileshare')
        .insert([{
            short_code: code,
            p2p_offer: '{}',
            transfer_mode: 'bidirectional',
            expires_at: new Date(Date.now() + 60000).toISOString()
        }])
        .select()
        .single();

    if (iErr) {
        console.error('❌ Insert Failed:', iErr.message);
        return;
    }
    console.log('✅ Inserted ID:', inserted.id, 'Code:', inserted.short_code);

    console.log('2. Updating p2p_answer...');
    // Explicitly asking for count
    const { data: updated, error: uErr, count } = await supabase
        .from('fileshare')
        .update({ p2p_answer: 'UPDATED_TEST' })
        .eq('short_code', code)
        .select()
        .count('exact'); // Request count

    if (uErr) {
        console.error('❌ Update Error:', uErr.message);
        // Special check for 404/RLS hints
        if (uErr.code === '42501') console.error('   (Permission Denied - RLS?)');
    } else {
        console.log('ℹ️ Update Params:', { code, val: 'UPDATED_TEST' });
        console.log('✅ Update returned. Rows:', updated ? updated.length : '?', 'Count:', count);
        if (updated && updated.length > 0) {
            console.log('   Returned Row Answer:', updated[0].p2p_answer);
        }
    }

    console.log('3. Fetching verification...');
    const { data: final } = await supabase
        .from('fileshare')
        .select('*')
        .eq('short_code', code)
        .single();

    console.log('   Final DB Value:', final ? final.p2p_answer : 'ROW MISSING');

    console.log('--- END DEBUG ---');
}

test();
