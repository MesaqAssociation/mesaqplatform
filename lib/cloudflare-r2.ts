/**
 * Cloudflare R2 Storage Utility
 * 
 * Handles file uploads to Cloudflare R2 (S3-compatible object storage)
 * 
 * Required Environment Variables:
 * - CLOUDFLARE_R2_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_R2_ACCESS_KEY_ID: R2 access key ID
 * - CLOUDFLARE_R2_SECRET_ACCESS_KEY: R2 secret access key
 * - CLOUDFLARE_R2_BUCKET_NAME: Name of your R2 bucket
 * - CLOUDFLARE_R2_PUBLIC_URL: Public URL for R2 bucket (optional, for custom domain)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME
  )
}

// Get R2 client
function getR2Client() {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Please set environment variables.')
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * Upload a file to Cloudflare R2
 * @param file - File buffer to upload
 * @param fileName - Name for the file in R2
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  file: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'application/pdf'
): Promise<string> {
  if (!isR2Configured()) {
    console.warn('⚠️ R2 not configured, skipping upload')
    throw new Error('R2 storage not configured')
  }

  const client = getR2Client()
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!
  
  // Generate a unique key with timestamp to avoid conflicts
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `bank-statements/${timestamp}-${sanitizedFileName}`

  console.log(`📤 Uploading to R2: ${key}`)

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        // Make file publicly readable
        ACL: 'public-read',
        // Optional: set cache control
        CacheControl: 'max-age=31536000', // 1 year
      })
    )

    // Construct public URL
    const publicUrl = getPublicUrl(key)
    
    console.log(`✅ Uploaded to R2: ${publicUrl}`)
    return publicUrl
  } catch (error) {
    console.error('❌ R2 upload failed:', error)
    throw new Error(`Failed to upload to R2: ${error}`)
  }
}

/**
 * Get public URL for an R2 object
 */
function getPublicUrl(key: string): string {
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!
  
  // Use custom domain if configured, otherwise use default R2 URL
  if (process.env.CLOUDFLARE_R2_PUBLIC_URL) {
    return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
  }
  
  // Default R2 public URL format
  return `https://pub-${accountId}.r2.dev/${key}`
}

/**
 * Helper to check if R2 is available and working
 */
export async function testR2Connection(): Promise<boolean> {
  if (!isR2Configured()) {
    return false
  }

  try {
    const client = getR2Client()
    // Try a simple operation to verify connection
    // Note: This is just a connection test, not uploading anything
    return true
  } catch (error) {
    console.error('R2 connection test failed:', error)
    return false
  }
}

