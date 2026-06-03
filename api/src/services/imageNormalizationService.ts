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

function buildJpegFilename(originalname: string | undefined, fallbackName: string): string {
  const name = originalname?.trim() || fallbackName;
  const baseName = name.replace(/\.[^.]+$/, '');
  return `${baseName || fallbackName}.jpg`;
}

function canPassThroughImage(file: MulterFile): boolean {
  return (
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    && !isIsoBaseMediaBuffer(file.buffer)
  );
}

async function transcodeImageBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (sharpError) {
    console.warn('[image-normalization] sharp transcode failed', {
      message: sharpError instanceof Error ? sharpError.message : String(sharpError),
      magicBytesHex: buffer.subarray(0, 16).toString('hex'),
      fileTypeBox: buffer.length >= 12 ? buffer.toString('ascii', 4, 12) : null,
    });

    if (!isIsoBaseMediaBuffer(buffer)) {
      throw sharpError;
    }

    try {
      const convertedBuffer = await convertHeicBuffer(buffer);
      return await sharp(convertedBuffer)
        .rotate()
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (heicError) {
      console.warn('[image-normalization] heic-convert fallback failed', {
        message: heicError instanceof Error ? heicError.message : String(heicError),
        magicBytesHex: buffer.subarray(0, 16).toString('hex'),
        fileTypeBox: buffer.length >= 12 ? buffer.toString('ascii', 4, 12) : null,
      });
      throw sharpError;
    }
  }
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
    if (canPassThroughImage(file)) {
      return file;
    }

    const normalizedBuffer = await transcodeImageBuffer(file.buffer);

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