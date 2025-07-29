import { Actor } from 'apify';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

try {
    console.log('🔄 Initializing actor...');
    await Actor.init();

    console.log('📥 Getting input...');
    const input = await Actor.getInput();
    const SUPABASE_KEY = input.supabaseKey;
    const SUPABASE_URL = input.supabaseUrl;
    const FEED_URL = input.feedUrl || 'https://contrataciondelestado.es/sindicacion/sindicacion_31500000_1.xml';

    console.log('🌐 Fetching XML...');
    const res = await fetch(FEED_URL);
    const xmlText = await res.text();

    console.log('🧠 Parsing XML...');
    const parsed = await parseStringPromise(xmlText, { explicitArray: false });
    const items = parsed.rss?.channel?.item || [];

    console.log(`📦 Found ${items.length} items`);

    for (const item of items) {
        const tender = {
            title: item.title?.trim(),
            description: item.description?.trim(),
            organization: "Unknown",
            category: "other",
            status: "open",
            publication_date: new Date(item.pubDate).toISOString().split('T')[0],
            deadline: null,
            region: null,
            cpv_code: "31500000-1",
            source_url: item.link,
            download_status: "pending",
            review_status: "pending"
        };

        console.log(`📤 Inserting tender: ${tender.title}`);

        const res = await fetch(SUPABASE_URL, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify([tender]),
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Supabase insert failed: ${res.status} - ${error}`);
        }

        const json = await res.json();
        console.log(`✅ Inserted: ${tender.title}`);
    }

    console.log('🏁 Done, exiting.');
    await Actor.exit();
} catch (err) {
    console.error('🔥 Fatal Error:', err.stack || err.message);
    process.exit(1);
}
