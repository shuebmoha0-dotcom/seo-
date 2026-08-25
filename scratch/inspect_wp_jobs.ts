import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkJobs() {
  const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  let supabaseUrl = '';
  let supabaseKey = '';

  for (const line of envContent.split('\n')) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
  }

  if (!supabaseUrl) supabaseUrl = 'https://tepgvouxfguglfbdxxwf.supabase.co';
  console.log('Supabase URL:', supabaseUrl, 'Key length:', supabaseKey.length);

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('--- wordpress_outbound_sites ---');
  const { data: sites, error: siteErr } = await supabase.from('wordpress_outbound_sites').select('*');
  console.log('Sites count:', sites?.length, 'Sites:', sites?.map((s: any) => ({ id: s.id, url: s.site_url, last_ping: s.last_ping_at, status: s.status })));

  console.log('--- wordpress_jobs ---');
  const { data: jobs, error: jobErr } = await supabase.from('wordpress_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Jobs count:', jobs?.length, 'Jobs:', jobs?.map((j: any) => ({ id: j.id, type: j.job_type, status: j.status, title: j.payload?.title, site_id: j.site_id, error: j.error })));

  console.log('--- content_drafts ---');
  const { data: drafts } = await supabase.from('content_drafts').select('id, working_title, primary_keyword, status, website_id').order('created_at', { ascending: false }).limit(3);
  console.log('Drafts:', drafts);
}

checkJobs();
