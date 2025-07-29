import { Actor } from 'apify';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

await Actor.init();

const input = await Actor.getInput();
const SUPABASE_KEY = input.supabaseKey;
const SUPABASE_URL = input.supabaseUrl;
const FEED_URL = input.feedUrl || 'https://contrataciondelestado.es/sindicacion/sindicacion_31500000_1.xml';

async function fetchXML(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch XML: ${res.status}`);
    const xmlText = await res.text();
    return parseStringPromise(xmlText, { explicitArray: false });
}

async function pushToSupabase(tender) {
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
        throw new Error(`Supabase insert failed for ${tender.title}: ${res.status} - ${error}`);
    }

    const json = await res.json();
    console.log(`✅ Inserted: ${tender.title}`);
    return json;
}

const parsed = await fetchXML(FEED_URL);
const items = parsed.rss?.channel?.item || [];

for (const item of items) {
    const tender = {
        title: item.title?.trim(),
        description: item.description?.trim(),
        publication_date: new Date(item.pubDate).toISOString(),
        deadline: null,
        region: null,
        cpv_code: '31500000-1',
        source: item.link,
        download_status: false,
        review_status: 'pending',
    };

    try {
        await pushToSupabase(tender);
    } catch (err) {
        console.error(`❌ Error inserting ${tender.title}:`, err.message);
    }
}

await Actor.exit();