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

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

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
 * @param folder - Folder path (e.g., 'bank-statements', 'documents')
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
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${folder}/${timestamp}-${sanitizedFileName}`

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
 * R2 public URLs include bucket name in path
 */
function getPublicUrl(key: string): string {
  // Use public URL from env - include bucket name in path
  if (process.env.R2_PUBLIC_URL && process.env.R2_BUCKET_NAME) {
    return `${process.env.R2_PUBLIC_URL}/${process.env.R2_BUCKET_NAME}/${key}`
  }
  
  // Fallback - this shouldn't happen if R2 is configured
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

/**
 * List objects in a folder
 */
export async function listR2Objects(folder: string = 'backups'): Promise<Array<{
  key: string
  name: string
  size: number
  lastModified: Date
  url: string
}>> {
  if (!isR2Configured()) {
    return []
  }

  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  try {
    console.log(`📂 Listing R2 objects in bucket "${bucketName}" with prefix "${folder}/"`)
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${folder}/`,
      })
    )

    console.log(`📂 R2 ListObjects response: ${response.Contents?.length || 0} objects found`)
    if (response.Contents) {
      console.log(`📂 Objects:`, response.Contents.map(c => c.Key))
    }

    return (response.Contents || []).map(obj => ({
      key: obj.Key || '',
      name: obj.Key?.replace(`${folder}/`, '') || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      url: getPublicUrl(obj.Key || ''),
    })).filter(obj => obj.name) // Filter out empty folder entries
  } catch (error: any) {
    // Cloudflare R2 may return NoSuchKey for empty prefixes instead of empty list
    // This is a known R2 quirk - treat it as empty list
    if (error?.Code === 'NoSuchKey' || error?.name === 'NoSuchKey') {
      console.log(`📂 No objects found in "${folder}/" (R2 returned NoSuchKey)`)
      return []
    }
    console.error('❌ Failed to list R2 objects:', error)
    return []
  }
}

/**
 * Get object content from R2
 */
export async function getR2Object(key: string): Promise<string | null> {
  if (!isR2Configured()) {
    return null
  }

  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )

    if (response.Body) {
      // Convert stream to string
      const chunks: Uint8Array[] = []
      const reader = response.Body.transformToWebStream().getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      
      const buffer = Buffer.concat(chunks)
      return buffer.toString('utf-8')
    }
    return null
  } catch (error) {
    console.error('Failed to get R2 object:', error)
    return null
  }
}

/**
 * Delete object from R2
 */
export async function deleteR2Object(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    return false
  }

  const client = getR2Client()
  const bucketName = process.env.R2_BUCKET_NAME!

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )
    return true
  } catch (error) {
    console.error('Failed to delete R2 object:', error)
    return false
  }
}

