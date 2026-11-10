const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'gcp-service-account.json'), 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const sc = google.searchconsole({ version: 'v1', auth: jwt });

  console.log('Querying Search Console dates...');
  const dateRes = await sc.searchanalytics.query({
    siteUrl: 'sc-domain:outdart.com',
    requestBody: {
      startDate: '2026-06-01',
      endDate: '2026-11-09',
      dimensions: ['date'],
      dataState: 'all',
      rowLimit: 1000,
    },
  });

  console.log('Querying Search Console queries...');
  const queryRes = await sc.searchanalytics.query({
    siteUrl: 'sc-domain:outdart.com',
    requestBody: {
      startDate: '2026-10-01',
      endDate: '2026-11-09',
      dimensions: ['query'],
      dataState: 'all',
      rowLimit: 100,
    },
  });

  const websiteId = 'df30a744-4b5f-4999-ac01-520f9f10d36d'; // outdart.com
  const dateRows = (dateRes.data.rows || []).map(r => ({
    website_id: websiteId,
    date: r.keys[0],
    query: null,
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position ? Math.round(r.position * 10) / 10 : 0,
  }));

  const queryRows = (queryRes.data.rows || []).map(q => ({
    website_id: websiteId,
    date: '2026-11-09',
    query: q.keys[0],
    clicks: q.clicks || 0,
    impressions: q.impressions || 0,
    ctr: q.ctr || 0,
    position: q.position ? Math.round(q.position * 10) / 10 : 0,
  }));

  console.log(`Clearing old rows for ${websiteId}...`);
  await supabase.from('search_console_data').delete().eq('website_id', websiteId);

  console.log(`Inserting ${dateRows.length} date rows...`);
  const { error: dateErr } = await supabase.from('search_console_data').insert(dateRows);
  if (dateErr) console.error('Date insert error:', dateErr);
  else console.log('Date rows inserted successfully!');

  console.log(`Inserting ${queryRows.length} query rows...`);
  const { error: queryErr } = await supabase.from('search_console_data').insert(queryRows);
  if (queryErr) console.error('Query insert error:', queryErr);
  else console.log('Query rows inserted successfully!');

  // Vault GCP Service Account in project_memory so Vercel can retrieve it
  console.log('Vaulting GCP Service Account in project_memory...');
  const { error: vaultErr } = await supabase.from('project_memory').upsert({
    website_id: websiteId,
    category: 'gcp_vault',
    source: 'system_service_account',
    content: JSON.stringify(sa),
    is_outdated: false,
  });
  if (vaultErr) console.error('Vault error:', vaultErr);
  else console.log('GCP Service Account vaulted successfully!');
}

run().catch(console.error);
