import sharp from 'sharp';

const heicConvert = require('heic-convert');

type MulterFile = Express.Multer.File;

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageNormalizationError';
  }
}

function isIsoBaseMediaBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }

  return buffer.toString('ascii', 4, 8) === 'ftyp';
}

async function convertHeicBuffer(buffer: Buffer): Promise<Buffer> {
  const converted = await heicConvert({
    buffer,
    format: 'PNG',
  });

  return Buffer.isBuffer(converted) ? converted : Buffer.from(converted);
}

async function decodeInputBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (metadata.format === 'heif') {
      return convertHeicBuffer(buffer);
    }

    return buffer;
  } catch (sharpError) {
    console.warn('[image-normalization] sharp decode failed', {
      message: sharpError instanceof Error ? sharpError.message : String(sharpError),
      magicBytesHex: buffer.subarray(0, 16).toString('hex'),
      fileTypeBox: buffer.length >= 12 ? buffer.toString('ascii', 4, 12) : null,
    });

    if (!isIsoBaseMediaBuffer(buffer)) {
      throw sharpError;
    }

    try {
      return await convertHeicBuffer(buffer);
    } catch (heicError) {
      console.warn('[image-normalization] heic-convert failed', {
        message: heicError instanceof Error ? heicError.message : String(heicError),
        magicBytesHex: buffer.subarray(0, 16).toString('hex'),
        fileTypeBox: buffer.length >= 12 ? buffer.toString('ascii', 4, 12) : null,
      });
      throw sharpError;
    }
  }
}

function buildJpegFilename(originalname: string | undefined, fallbackName: string): string {
  const name = originalname?.trim() || fallbackName;
  const baseName = name.replace(/\.[^.]+$/, '');
  return `${baseName || fallbackName}.jpg`;
}

export async function normalizeUploadedImage(
  file: MulterFile | undefined,
  fallbackName: string,
): Promise<MulterFile | undefined> {
  if (!file) {
    return undefined;
  }

  if (!file.mimetype?.startsWith('image/')) {
    throw new ImageNormalizationError('Only image uploads are allowed');
  }

  try {
    console.log('[image-normalization] normalizing upload', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      magicBytesHex: file.buffer.subarray(0, 16).toString('hex'),
      fileTypeBox: file.buffer.length >= 12 ? file.buffer.toString('ascii', 4, 12) : null,
    });

    const decodedBuffer = await decodeInputBuffer(file.buffer);

    const normalizedBuffer = await sharp(decodedBuffer)
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      ...file,
      buffer: normalizedBuffer,
      size: normalizedBuffer.length,
      mimetype: 'image/jpeg',
      originalname: buildJpegFilename(file.originalname, fallbackName),
    };
  } catch (error) {
    throw new ImageNormalizationError(
      `Unsupported or corrupt image upload: ${file.originalname || fallbackName}`,
    );
  }
}