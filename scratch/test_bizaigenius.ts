async function testSite() {
  const res = await fetch('https://bizaigenius.com/wp-json/seo-autopilot/v1/site');
  console.log('Site endpoint status without auth:', res.status);
  const data = await res.json();
  console.log('Response:', data);
}

testSite();
