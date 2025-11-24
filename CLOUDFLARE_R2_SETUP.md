# Cloudflare R2 Storage Setup Guide

This guide explains how to set up Cloudflare R2 for storing bank statement files.

## What is Cloudflare R2?

Cloudflare R2 is S3-compatible object storage that's:
- **Free up to 10 GB/month** (more than enough for PDFs)
- **No egress fees** (unlike AWS S3)
- **Fast and reliable** global CDN
- **Simple to set up**

## Why Use R2?

Without R2, bank statements are parsed but the files are not stored permanently. With R2:
- ✅ Keep permanent copies of all uploaded statements
- ✅ Allow users to re-download statements
- ✅ Audit trail for compliance
- ✅ Backup and recovery

## Setup Steps

### 1. Create Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free tier is fine)
2. No need to add a domain if you don't have one

### 2. Create R2 Bucket

1. In Cloudflare Dashboard, go to **R2** (in the sidebar)
2. Click **Create bucket**
3. Name it something like `mesaq-bank-statements`
4. Choose location: **Automatic** is fine
5. Click **Create bucket**

### 3. Enable Public Access (Optional but Recommended)

1. In your bucket settings, go to **Settings** tab
2. Under **Public Access**, click **Allow Access**
3. This lets you serve files publicly (needed for viewing statements)
4. Note the public URL (looks like `https://pub-xxxxx.r2.dev`)

### 4. Create API Token

1. In R2 section, click **Manage R2 API Tokens**
2. Click **Create API token**
3. Give it a name: `Mesaq Upload Token`
4. **Permissions**: 
   - Object Read & Write
   - Bucket: Select your bucket
5. Click **Create API token**
6. **Important**: Copy the credentials NOW (you won't see them again):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (contains your Account ID)

### 5. Add Environment Variables

Add these to your `.env` file (or Vercel environment variables):

```bash
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id_from_endpoint
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=mesaq-bank-statements
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # From step 3
```

### 6. Deploy

That's it! Next time you upload a bank statement (web or Telegram), it will:
1. Parse the PDF as before
2. **Upload the PDF to R2**
3. Store the R2 URL in the database
4. Link all transactions to that statement

## Testing

1. Upload a bank statement via web or Telegram
2. Check the server logs for: `✅ Uploaded to R2: https://...`
3. Check your R2 bucket - you should see the file
4. Open a transaction detail popup - it should show the bank statement name

## Troubleshooting

### "R2 not configured, skipping file upload"
- Check that all 4 R2 environment variables are set
- Restart your server after adding variables

### "Failed to upload to R2"
- Verify your API token has Object Write permissions
- Check that the bucket name matches exactly
- Ensure Account ID is correct (from the endpoint URL)

### Files uploaded but can't view them
- Make sure public access is enabled on your bucket
- Check that CLOUDFLARE_R2_PUBLIC_URL is set correctly

## Cost

With the free tier:
- **10 GB storage/month**: ~10,000+ PDF statements
- **10 million Class A operations**: More than you'll ever need
- **No egress fees**: Unlimited downloads

You'll likely stay on the free tier forever!

## Optional: Custom Domain

Instead of `pub-xxxxx.r2.dev`, you can use your own domain:

1. In R2 bucket settings, go to **Settings** > **Custom Domains**
2. Click **Connect Domain**
3. Choose a subdomain like `files.yourdomain.com`
4. Follow the DNS setup instructions
5. Update `CLOUDFLARE_R2_PUBLIC_URL` to your custom domain

## Security Notes

- ✅ Files are stored with unique names to prevent conflicts
- ✅ Only authenticated users can upload (API checks JWT)
- ✅ Public read access is intentional (statements need to be viewable)
- ⚠️ Don't commit your API keys to git (they're in .env)
- ⚠️ Rotate API tokens if compromised

## Without R2

If you don't set up R2:
- ✅ Everything still works
- ✅ Transactions are still imported
- ✅ Member matching still works
- ❌ Files are not permanently stored
- ❌ Can't re-download statements later

It's optional but highly recommended!

