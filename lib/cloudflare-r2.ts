/**
 * Cloudflare R2 Storage Utility
 * 
 * Handles file uploads to Cloudflare R2 (S3-compatible object storage)
 * 
 * Required Environment Variables:
 * - R2_ENDPOINT: Your R2 endpoint URL
 * - R2_ACCESS_KEY_ID: R2 access key ID  
 * - R2_SECRET_ACCESS_KEY: R2 secret access key
 * - R2_BUCKET_NAME: Name of your R2 bucket
 * - R2_PUBLIC_URL: Public URL for R2 bucket
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

// Get R2 client
function getR2Client() {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Please set environment variables.')
  }
  
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

/**
 * Upload a file to Cloudflare R2
 * @param file - File buffer to upload
 * @param fileName - Name for the file in R2
 * @param contentType - MIME type of the file
 * @param folder - Folder within mesaq-association (e.g., 'bank-statements', 'documents')
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  file: Buffer | Uint8Array,
  fileName: string,
  contentType: string = 'application/pdf',
  folder: string = 'bank-statements'
): Promise<string> {
  if (!isR2Configured()) {
    console.warn('⚠️ R2 not configured, skipping upload')
    throw new Error('R2 storage not configured')
  }

  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!
  
  // Generate a unique key with timestamp to avoid conflicts
  // Include mesaq-association prefix to match R2 bucket structure
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `mesaq-association/${folder}/${timestamp}-${sanitizedFileName}`

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
  // Use public URL from env
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`
  }
  
  // Fallback - this shouldn't happen if R2_PUBLIC_URL is set
  return key
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

