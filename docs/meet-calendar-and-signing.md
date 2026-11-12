# Kayak - switching on Google Drive, calendar sync, town halls and signed installers

Everything below is entered in **GitHub → caamc/kayaksa → Settings → Secrets and variables → Actions → New repository secret**.
Never paste a key, password or certificate into a chat or an email. The next deploy picks the secrets up by itself.

---

## 1. Town halls and the TURN relay (Cloudflare Realtime)

Meet creates its Cloudflare Realtime app (town halls) and TURN key (relay) automatically on the next deploy,
but only if the Cloudflare API token it deploys with is allowed to.

1. Cloudflare dashboard → **My Profile → API Tokens** → edit the token stored in the `CLOUDFLARE_API_TOKEN` secret.
2. Add the permission **Account → Realtime → Edit**. In some dashboards this permission is called
   *Realtime Admin* or *Calls Write*.
3. Save. Then re-run the **Deploy** workflow (Actions → Deploy → Run workflow), or push any change to `apps/meet`.
4. The run summary says "Created the Cloudflare Realtime app for Meet town halls" and "Created a TURN relay key".

**Monthly limits** are enforced in code (`apps/meet/src/usage.ts`). Each service stops a little before its limit:

| Meter | Limit | Stops at |
|---|---|---|
| Data through TURN relay + Realtime SFU | 950 GB | 947 GB |
| Audio + video participant minutes | 9,500 | 9,440 |
| Audio-only participant minutes | 9,500 | 9,440 |
| Audio + video recording/streaming minutes (Cloudflare) | 95 | 93 - not used by Meet |
| Audio-only recording/streaming minutes (Cloudflare) | 95 | 93 - not used by Meet |
| Raw RTP export minutes | 95 | 93 - not used by Meet |

The limits reset on the day set in `apps/meet/wrangler.jsonc` → `vars.USAGE_CYCLE_DAY` (default `1`).
Set it to the day of the month Cloudflare bills Kayak on. Kayak team members can see the meters under
their profile menu → **Cloudflare usage this month**.

---

## 2. Document Drive in the "Kayak Document Drive" shared drive (Kayak Internal)

Done so far: the shared drive **Kayak Document Drive**, the Google Cloud project **kayak-internal**, and the
Google Drive API. Remaining (one OAuth client also serves Meet's Google Calendar sync):

1. In **kayak-internal**: **Google Auth Platform → Branding / Audience** (the OAuth consent screen). Choose
   **Internal**, app name `Kayak Internal`, support email, and the authorised domain `kayaksa.com`.
2. **Data access → Add scopes**: `openid`, `email`, `.../auth/drive`, and for Meet `.../auth/calendar.events`.
   With an Internal app, Google doesn't need to review these.
3. **Clients → Create client → Web application**, named `Kayak web sign-in`. Authorised redirect URIs:
   - `https://internal.kayaksa.com/oauth/drive/callback`
   - `https://meet.kayaksa.com/calendar/callback/google`
4. Copy the Client ID and Client secret straight into GitHub secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Choose the Google account that will hold the connection, ideally a SuperAdmin's Workspace account.
   Add it to **Kayak Document Drive** as a **Content manager** or Manager.
6. After the next deploy, that SuperAdmin opens Kayak Internal → **Document Drive** → **Connect Google Drive**
   and signs in. Kayak Internal finds the shared drive and creates the folder
   *Kayak Internal - Document Vault (encrypted)*. Then choose **Move … from R2** to move existing documents.

The files in the shared drive are encrypted (`.kdd`) and can't be read in Google Drive itself. They open only
through Kayak Internal, which asks for a reason and logs every view. Keep the shared drive's membership small,
and don't let anyone rename or edit the files. A file that is changed in Drive no longer decrypts.

## 3. Two-way calendar sync

### Outlook / Microsoft 365

1. <https://entra.microsoft.com> → **App registrations → New registration**.
   - Name: `Meet by Kayak`
   - Supported account types: *Accounts in this organizational directory only* (Kayak staff only),
     or *any organizational directory* if clients should connect their calendars too.
   - Redirect URI: **Web** → `https://meet.kayaksa.com/calendar/callback/microsoft`
2. **API permissions → Add → Microsoft Graph → Delegated**: `offline_access`, `openid`, `email`,
   `User.Read`, `Calendars.ReadWrite`. Then **Grant admin consent**.
3. **Certificates & secrets → New client secret**. Copy the *Value* straight into GitHub.
4. GitHub secrets:
   - `MS_CLIENT_ID` - the Application (client) ID
   - `MS_CLIENT_SECRET` - the secret value
   - `MS_TENANT` - the Directory (tenant) ID (single-tenant), or leave it unset for multi-tenant

### Google Calendar

1. In the **kayak-internal** project → **APIs & Services → Library** → enable **Google Calendar API**.
   The OAuth client from section 2 is used for this too.
2. **OAuth consent screen**: choose **Internal** if Kayak uses Google Workspace (no Google review needed).
   *External* works too, but Google must verify apps that ask for calendar access before the public can use them.
   Scopes: `openid`, `email`, `.../auth/calendar.events`.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorised redirect URI: `https://meet.kayaksa.com/calendar/callback/google`
4. GitHub secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

After the next deploy, people connect their calendar in Meet → Planner → **Calendars** (or profile menu →
Calendar sync). Tokens are encrypted before they are stored; disconnecting deletes them.

---

## 4. Signed desktop installers

Unsigned, Windows shows a SmartScreen warning and macOS asks people to right-click → Open; macOS automatic
updates only work once the app is signed. After adding the secrets, run **Actions → Desktop app → Run workflow**.

### macOS (Apple)

1. Enrol Kayak Strategic Advisors Private Limited in the **Apple Developer Program** as an *organisation*
   (US$99 a year). Apple asks for the company's **D-U-N-S number** (free from Dun & Bradstreet) and verifies it.
2. On a Mac with Xcode: **Settings → Accounts → Manage Certificates → + → Developer ID Application**.
   (Or create it at developer.apple.com → Certificates with a certificate signing request from Keychain Access.)
3. In Keychain Access, export the *Developer ID Application* certificate with its private key as a `.p12`
   file and give it a strong password.
4. Turn the file into one line of text: `base64 -i DeveloperID.p12 | pbcopy`
5. At appleid.apple.com create an **app-specific password** (for notarisation).
6. GitHub secrets:
   - `MAC_CERT_P12_BASE64` - the base64 text
   - `MAC_CERT_PASSWORD` - the .p12 password
   - `APPLE_ID` - the Apple ID email of the developer account
   - `APPLE_APP_SPECIFIC_PASSWORD` - the app-specific password
   - `APPLE_TEAM_ID` - the 10-character Team ID (developer.apple.com → Membership)

### Windows

Since June 2023, every publicly trusted code-signing certificate must keep its private key in a hardware
security module, so it can no longer be downloaded as a `.pfx` file. The workflow therefore signs with a
certificate held in **Azure Key Vault (Premium, HSM-backed)**:

1. Buy an **OV code-signing certificate** in the company's name from a certificate authority that supports
   Azure Key Vault (for example DigiCert or GlobalSign). The CA verifies the company: certificate of
   incorporation, an official phone listing or D-U-N-S, and a call to a named officer.
   (An EV certificate no longer skips SmartScreen's reputation check, so OV is usually enough.)
2. In Azure: create a **Key Vault** on the *Premium* tier → **Certificates → Generate/Import** → choose the CA's
   integration (or *certificate issued by a non-integrated CA*), key type **RSA-HSM**, 3072 bits.
   Send the CSR to the CA, then **Merge** the issued certificate.
3. Create an **app registration** (service principal) with a client secret, and give it the roles
   **Key Vault Crypto User** and **Key Vault Certificate User** on the vault.
4. GitHub secrets: `AZURE_KEY_VAULT_URI` (e.g. `https://kayak-sign.vault.azure.net`), `AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_CERT_NAME`.

Microsoft's own *Artifact Signing* (formerly Trusted Signing) is simpler and cheaper, but at present Microsoft
only accepts organisations based in the US and Canada. If that opens up to India, the workflow can switch to it.

32-bit Windows can't be built: the Electron framework the app is built on stopped supporting it.
