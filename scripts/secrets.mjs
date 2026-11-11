// Prints a JSON object of the named environment variables that are set, for `wrangler secret bulk`.
// Values are never printed to the log by the workflow; this output goes straight to a temp file.
const out = {};
for (const k of process.argv.slice(2)) if (process.env[k]) out[k] = process.env[k];
process.stdout.write(JSON.stringify(out));
