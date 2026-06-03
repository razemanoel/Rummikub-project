import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { PreparedUploadImage } from '@/types/rummikub';

const MOBILE_MAX_IMAGE_SIDE = 2560;
const MOBILE_JPEG_QUALITY = 0.9;

function isPreparedJpegAsset(asset: ImagePicker.ImagePickerAsset): boolean {
  const mimeType = asset.mimeType?.toLowerCase();
  const uri = asset.uri.toLowerCase();

  return mimeType === 'image/jpeg' || mimeType === 'image/jpg' || uri.endsWith('.jpg') || uri.endsWith('.jpeg');
}

function buildPreparedFileName(
  type: 'myBoard' | 'shared',
  source: 'camera' | 'gallery',
): string {
  return `${type}-${source}-${Date.now()}.jpg`;
}

export async function prepareImageForUpload(
  asset: ImagePicker.ImagePickerAsset,
  type: 'myBoard' | 'shared',
  source: 'camera' | 'gallery',
): Promise<PreparedUploadImage> {
  const originalWidth = asset.width ?? 0;
  const originalHeight = asset.height ?? 0;
  const longestSide = Math.max(originalWidth, originalHeight);

  if (isPreparedJpegAsset(asset) && longestSide <= MOBILE_MAX_IMAGE_SIDE) {
    const fileInfo = await FileSystemLegacy.getInfoAsync(asset.uri);
    const preparedImage: PreparedUploadImage = {
      uri: asset.uri,
      mimeType: 'image/jpeg',
      fileName: buildPreparedFileName(type, source),
      width: originalWidth,
      height: originalHeight,
      fileSize: fileInfo.exists && !fileInfo.isDirectory ? (fileInfo.size ?? null) : null,
    };

    return preparedImage;
  }

  const actions: ImageManipulator.Action[] = [];
  if (longestSide > MOBILE_MAX_IMAGE_SIDE) {
    if (originalWidth >= originalHeight) {
      actions.push({ resize: { width: MOBILE_MAX_IMAGE_SIDE } });
    } else {
      actions.push({ resize: { height: MOBILE_MAX_IMAGE_SIDE } });
    }
  }

  const manipulatedImage = await ImageManipulator.manipulateAsync(
    asset.uri,
    actions,
    {
      compress: MOBILE_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const fileInfo = await FileSystemLegacy.getInfoAsync(manipulatedImage.uri);
  const preparedImage: PreparedUploadImage = {
    uri: manipulatedImage.uri,
    mimeType: 'image/jpeg',
    fileName: buildPreparedFileName(type, source),
    width: manipulatedImage.width,
    height: manipulatedImage.height,
    fileSize: fileInfo.exists && !fileInfo.isDirectory ? (fileInfo.size ?? null) : null,
  };

  return preparedImage;
}