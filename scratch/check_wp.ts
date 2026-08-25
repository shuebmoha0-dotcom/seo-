import { createClient } from '@supabase/supabase-js';

async function checkWpConnections() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  console.log('--- Checking websites ---');
  const { data: websites } = await supabase.from('websites').select('*');
  console.log('Websites:', websites);

  console.log('--- Checking wordpress_outbound_sites ---');
  const { data: outboundSites } = await supabase.from('wordpress_outbound_sites').select('*');
  console.log('Outbound Sites:', outboundSites);

  console.log('--- Checking wordpress_jobs ---');
  const { data: jobs } = await supabase.from('wordpress_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Recent Jobs:', jobs);

  console.log('--- Checking integrations table if exists ---');
  const { data: integrations } = await supabase.from('integrations').select('*');
  console.log('Integrations:', integrations);
}

checkWpConnections();
