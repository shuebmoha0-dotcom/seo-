const fs = require('fs');
let content = fs.readFileSync('src/app/api/integrations/route.ts', 'utf8');

const oldLogic = `    // Check if WordPress outbound site is active and ensure it reflects in integrations
    const { data: outboundSite } = await supabase
      .from('wordpress_outbound_sites')
      .select('*')
      .eq('status', 'active')
      .order('last_ping_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (outboundSite) {
      const wpItem = (data || []).find((i: any) => i.provider === 'wordpress');
      if (!wpItem) {
        // Run a quick live health check on the site to see if the plugin is actually still installed
        let liveStatus = 'connected';
        let liveMessage = \`Connected to \${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector\`;
        
        try {
          const siteUrl = outboundSite.site_url.replace(/\\/+$/, '');
          const ping = await fetch(\`\${siteUrl}/wp-json/seo-autopilot/v1/status\`, { 
            method: 'GET', 
            signal: AbortSignal.timeout(6000) 
          });
          
          if (!ping.ok) {
            liveStatus = 'action_required';
            liveMessage = 'Plugin returned an error. It may be deactivated or restricted by a firewall.';
            supabase.from('wordpress_outbound_sites')
              .update({ status: 'action_required', updated_at: new Date().toISOString() })
              .eq('id', outboundSite.id)
              .then(() => {});
          } else {
            // Restore active status if it was erroneously marked action_required
            supabase.from('wordpress_outbound_sites')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', outboundSite.id)
              .then(() => {});
          }
        } catch (e) {
          // Fallback to connected if it merely timed out, to avoid aggressively marking action required
          liveStatus = 'connected';
          liveMessage = \`Connected to \${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector (Slow connection)\`;
        }`;

const newLogic = `    // Check if WordPress outbound site is active and ensure it reflects in integrations
    const { data: outboundSite } = await supabase
      .from('wordpress_outbound_sites')
      .select('*')
      // Don't filter by active only, because our old buggy ping might have marked it action_required
      .neq('status', 'disconnected')
      .order('last_ping_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (outboundSite) {
      const wpItem = (data || []).find((i: any) => i.provider === 'wordpress');
      if (!wpItem) {
        // Evaluate health based solely on heartbeat/ping timestamp (Outbound Architecture)
        const lastPing = new Date(outboundSite.last_ping_at).getTime();
        const now = Date.now();
        const minutesSincePing = (now - lastPing) / (1000 * 60);
        
        let liveStatus = 'connected';
        let liveMessage = \`Connected to \${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector\`;
        
        // If it hasn't pinged in 30 minutes, it might be disabled
        if (minutesSincePing > 30) {
           liveStatus = 'action_required';
           liveMessage = 'The WordPress plugin stopped responding. Please ensure it is active.';
        } else if (outboundSite.status === 'action_required') {
           // Auto-heal the database record if it was broken by the old Vercel ping logic
           supabase.from('wordpress_outbound_sites')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', outboundSite.id)
              .then(() => {});
        }
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/app/api/integrations/route.ts', content);
