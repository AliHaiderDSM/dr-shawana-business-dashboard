const MB = 1024 * 1024;
export const MAX_REPORT_FILES = 5;
export const MAX_UPLOAD_BYTES = 4.3 * MB;
const MAX_SIDE = 2000;
const QUALITY = 0.85;
const SHRINK_ABOVE = 0.8 * MB;

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const REPORT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export class ReportFileError extends Error {}

function typeOf(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return '';
}

export function formatSize(bytes: number) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function toJpeg(file: File, type: string): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const big = file.size > SHRINK_ABOVE || scale < 1;
  const heic = type === 'image/heic' || type === 'image/heif';
  if (!big && !heic) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) return null;
  if (!heic && blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, '') || 'report';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
}

export async function prepareReportFiles(files: File[]) {
  if (files.length > MAX_REPORT_FILES) {
    throw new ReportFileError(`Choose up to ${MAX_REPORT_FILES} reports at a time.`);
  }
  const ready: File[] = [];
  for (const file of files) {
    const type = typeOf(file);
    if (!ACCEPTED.includes(type)) {
      throw new ReportFileError(`${file.name}: upload a PDF or a photo (JPG, PNG, WebP or HEIC).`);
    }
    if (type === 'application/pdf') {
      ready.push(file);
      continue;
    }
    const converted = await toJpeg(file, type);
    if (converted) ready.push(converted);
    else if (type === 'image/heic' || type === 'image/heif') {
      ready.push(
        type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified }),
      );
    } else {
      ready.push(file);
    }
  }
  const total = ready.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    const sizes = ready.map((file) => `${file.name} ${formatSize(file.size)}`).join(', ');
    throw new ReportFileError(
      ready.length > 1
        ? `These files come to ${formatSize(total)} together (${sizes}). The limit is 4.3 MB per upload: send them in two or three goes.`
        : `${ready[0]?.name} is ${formatSize(total)}. The limit is 4.3 MB: use a smaller scan, or split the PDF.`,
    );
  }
  return ready;
}
