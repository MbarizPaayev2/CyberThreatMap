import supabaseAdmin from '../../lib/supabaseAdmin.js';
import MockProvider from '../../lib/providers/mockProvider.js';

export default async function handler(req, res) {
  // CRON_SECRET yoxlaması - Yalnızca icazəli Vercel mühiti (və ya test edən) bura daxil ola bilər.
  const authHeader = req.headers['authorization'];
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const provider = new MockProvider();
    
    // Hər 1 dəqiqə ərzində neçə event olacaq? (1 ilə 5 arası)
    const eventCount = Math.floor(Math.random() * 5) + 1;
    const events = [];

    for (let i = 0; i < eventCount; i++) {
      events.push(await provider.generateEvent());
    }

    // Insert events to Supabase DB using the admin service key (RLS bypass)
    const { data, error } = await supabaseAdmin
      .from('threat_events')
      .insert(events)
      .select();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Generated and inserted ${eventCount} events.`,
      events: data
    });

  } catch (error) {
    console.error("Generate events error:", error);
    return res.status(500).json({ error: error.message });
  }
}
