# Environment Variables Setup

## Required Environment Variables

Add these to your `.env.local` file:

### OpenAI API Key (for AI Payment Matching)
```bash
OPENAI_API_KEY=sk-proj-...your-key-here
```

**How to get it:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and paste it here

**Note:** 
- The system uses GPT-4o model (latest, most capable)
- No token limit is set - the AI can use as many tokens as needed
- Cost is approximately $0.01-0.05 per payment detection run (depending on number of transactions)
- AI matching only runs if phone and banking name matching don't find all payments

### Other Required Variables
```bash
DATABASE_URL=your-supabase-connection-string
AUTH_SECRET=your-jwt-secret
CLOUDFLARE_R2_ACCOUNT_ID=your-r2-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name
MONTHLY_FEE=50.00
```

## Payment Detection System

The system uses a 6-step intelligent payment matching process:

### Step 1: Phone Number Matching
- Searches transaction descriptions for member phone numbers (04XXXXXXXX)
- Exact amount matching (within $0.50 tolerance)
- Most reliable method

### Step 2: Banking Name Matching
- Searches for banking names in transaction descriptions
- Case-insensitive matching
- Fallback for members without phone numbers

### Step 3-4: Identify Remaining
- Collects unpaid members
- Collects unmatched transactions

### Step 5: AI-Powered Matching (OpenAI)
- Uses GPT-4o to intelligently match remaining transactions
- Analyzes:
  - Name similarities (full name, first/last name, nicknames)
  - Email patterns
  - Address references
  - Common payment patterns
  - Member ID references
- Only suggests high/medium confidence matches
- Provides reasoning for each match

### Step 6: Final Report
- Lists members still unpaid
- Detailed log of all matches
- Summary statistics

## How It Works

1. **Bank statement uploaded** → Transactions imported
2. **Auto-detection triggered** → 6-step process runs
3. **Results displayed** → Shows matched payments and unpaid members
4. **Payment statuses updated** → Members table reflects current status

## Cost Optimization

The AI matching:
- Only runs if needed (after phone/banking name matching)
- Uses efficient prompting to minimize tokens
- Caches member and transaction data
- Typical cost: $0.01-0.05 per run
- Worth it for accurate payment tracking!

