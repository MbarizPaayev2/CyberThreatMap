import supabaseAdmin from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  // CORS Headers for API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Execute the RPC function defined in migration
    const { data, error } = await supabaseAdmin.rpc('get_today_stats');

    if (error) throw error;

    return res.status(200).json(data);
  } catch (error) {
    console.error("Today stats error:", error);
    return res.status(500).json({ error: error.message });
  }
}
