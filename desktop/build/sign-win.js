// Windows code signing through a cloud key store. Since June 2023 every publicly trusted code-signing
// certificate (OV or EV) must keep its private key in a hardware security module, so the key cannot be
// exported to a .pfx file. Kayak's certificate is kept in Azure Key Vault (Premium, HSM-backed) and
// signed with AzureSignTool. The private key never leaves the vault.
//
// The "Desktop app" workflow turns this on only when the AZURE_* secrets exist.
const { execFileSync } = require("child_process");
module.exports = async function sign(cfg) {
  if (cfg.hash && cfg.hash !== "sha256") return; // sign once, with SHA-256
  const e = process.env;
  if (!e.AZURE_KEY_VAULT_URI) return;
  execFileSync("AzureSignTool", [
    "sign", "-kvu", e.AZURE_KEY_VAULT_URI, "-kvi", e.AZURE_CLIENT_ID, "-kvt", e.AZURE_TENANT_ID, "-kvs", e.AZURE_CLIENT_SECRET,
    "-kvc", e.AZURE_CERT_NAME, "-tr", e.TIMESTAMP_URL || "http://timestamp.digicert.com", "-td", "sha256", "-fd", "sha256",
    "-d", "Meet by Kayak", "-du", "https://meet.kayaksa.com", "-v", cfg.path,
  ], { stdio: "inherit" });
};
