# Environment Variables Setup

## Required Environment Variables

### Database
```
DATABASE_URL=postgresql://postgres.xxx:password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```
Use the **transaction pooler** URL from Supabase for serverless deployments.

### Authentication
```
AUTH_SECRET=your-secret-key-here
```
Generate with: `openssl rand -base64 32`

### Cloudflare R2 (Image Uploads)
```
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-public-domain.com
```

**Setup Instructions:**
1. Go to Cloudflare Dashboard → R2
2. Create a new bucket (e.g., "mesaq-members")
3. Go to **Manage R2 API Tokens** → Create API Token
4. Copy the Access Key ID and Secret Access Key
5. For `R2_ENDPOINT`: Use format `https://<account-id>.r2.cloudflarestorage.com`
6. For `R2_PUBLIC_URL`: 
   - Go to your bucket settings
   - Enable "Public Access" or set up a custom domain
   - Use the public URL (e.g., `https://pub-xxxxx.r2.dev` or your custom domain)

### Google Maps API (Address Autocomplete)
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**Setup Instructions:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Places API** (this is the main one needed for autocomplete)
4. Go to **Credentials** → Create Credentials → API Key
5. Restrict the key to your domain for security (optional but recommended)
6. Copy the API key and add it to Vercel environment variables
7. **Important:** Redeploy your app after adding the env var for it to take effect

### Telegram Bot (Bank Statement Upload & Create Features)
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

**Setup Instructions:**
1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command to create a new bot
3. Choose a name (e.g., "Mesaq Bank Statement Bot")
4. Choose a username (e.g., "mesaq_bank_bot")
5. BotFather will give you a token like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
6. Copy the token and add it to your environment variables
7. After deploying, run: `npx tsx scripts/setup-telegram-bot.ts` to configure webhook

**Features:**
- 📄 Upload bank statements via PDF
- 📅 Create events with interactive buttons
- 👤 Add members through conversational flow
- See `TELEGRAM_BOT_SETUP.md` for detailed setup guide

### Membership Settings
```
MONTHLY_FEE=50.00
```

**Description:**
- Monthly membership fee amount in dollars (e.g., 50.00 for $50)
- Used to detect membership payments in bank statements
- Used to calculate payment status for members

## Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add new columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Community Member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create events table for tracking member event attendance
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_type TEXT DEFAULT 'Event',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_events junction table for tracking attendance
CREATE TABLE IF NOT EXISTS member_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_event ON member_events(event_id);
```

