import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PublicDriveFolderReader, parsePublicDriveFolder, driveThumbnailUrl, fetchDriveImage, type DrivePhoto, type DrivePhotoChoice } from '@roniella/shared/google-drive';
import { jpegDimensions } from '../../../back/src/google-photos';
const reader = new PublicDriveFolderReader();
export async function readEditorFolder(url: string, fresh = false) {
  if (process.env.DEPLOYMENT_ENV === 'local' && /^http:\/\/127\.0\.0\.1:/.test(process.env.SUPABASE_URL ?? '') && process.env.RONIELLA_TEST_DRIVE_HTML)
    return parsePublicDriveFolder(await readFile(process.env.RONIELLA_TEST_DRIVE_HTML, 'utf8'), url);
  return reader.read(url, fresh);
}
export const linkedDriveId = (fileId: string) => 'drive-' + createHash('md5').update(fileId).digest('hex');
export function drivePhotoChoice(photo: DrivePhoto): DrivePhotoChoice {
  return { ...photo, id: linkedDriveId(photo.sourceId), thumbnail: driveThumbnailUrl(photo.sourceId, 360), alt: photo.name };
}
export async function editorImageDimensions(fileId: string, signal: AbortSignal) {
  if (process.env.DEPLOYMENT_ENV === 'local' && /^http:\/\/127\.0\.0\.1:/.test(process.env.SUPABASE_URL ?? '') && process.env.RONIELLA_TEST_DRIVE_HTML) return { width: 1200, height: 1600 };
  const image = await fetchDriveImage(driveThumbnailUrl(fileId, 1600), signal);
  if (image.contentType.startsWith('image/jpeg')) return jpegDimensions(image.bytes);
  if (image.contentType.startsWith('image/png') && image.bytes.length >= 24) { const data = new DataView(image.bytes.buffer); return { width: data.getUint32(16), height: data.getUint32(20) }; }
  throw Error('Unsupported image rendition');
}
