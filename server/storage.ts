import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "us-east-005",
      endpoint: `https://${process.env.B2_ENDPOINT}`,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID!,
        secretAccessKey: process.env.B2_APP_KEY!,
      },
    });
  }
  return s3Client;
}

const BUCKET = process.env.B2_BUCKET || "Movie-Party";

export function isCloudStorageConfigured(): boolean {
  return !!(process.env.B2_ENDPOINT && process.env.B2_KEY_ID && process.env.B2_APP_KEY);
}

export async function uploadToCloud(key: string, stream: Readable, contentType: string): Promise<void> {
  const upload = new Upload({
    client: getClient(),
    params: { Bucket: BUCKET, Key: key, Body: stream, ContentType: contentType },
  });
  await upload.done();
}

export async function getFileInfo(key: string): Promise<{ size: number; contentType: string }> {
  const res = await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return { size: res.ContentLength || 0, contentType: res.ContentType || "video/mp4" };
}

export async function getFileStream(key: string, range?: { start: number; end: number }): Promise<{
  stream: Readable;
  contentLength: number;
  contentRange?: string;
  statusCode: number;
}> {
  const rangeHeader = range ? `bytes=${range.start}-${range.end}` : undefined;
  const res = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: rangeHeader }));
  const stream = res.Body as Readable;

  if (range) {
    const info = await getFileInfo(key);
    return {
      stream,
      contentLength: range.end - range.start + 1,
      contentRange: `bytes ${range.start}-${range.end}/${info.size}`,
      statusCode: 206,
    };
  }

  return { stream, contentLength: res.ContentLength || 0, statusCode: 200 };
}

export async function deleteFromCloud(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {}
}
