// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) about every page in each site's
// sitemap, right after a deploy. The key file is served by each site at /<key>.txt. Never fails the deploy.
import { createHash } from "node:crypto";
const hosts = process.argv.slice(2);
for (const host of hosts) {
  try {
    const key = createHash("sha256").update("indexnow:" + host).digest("hex").slice(0, 32);
    const xml = await (await fetch(`https://${host}/sitemap.xml`)).text();
    const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(`https://${host}/`)).slice(0, 10000);
    if (!urlList.length) { console.log(`${host}: no URLs in the sitemap`); continue; }
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }) });
    console.log(`${host}: ${urlList.length} URLs sent to IndexNow (HTTP ${r.status})`);
  } catch (e) { console.log(`${host}: IndexNow skipped (${e.message})`); }
}
