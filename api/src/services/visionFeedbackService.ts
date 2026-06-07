import { createHash } from 'crypto';
import {
  VisionFeedbackBBox,
  VisionFeedbackCorrectionInput,
  VisionFeedbackCorrectionType,
  VisionFeedbackPayload,
  VisionFeedbackRecord,
  VisionFeedbackSourceDetections,
  VisionFeedbackTile,
} from '../models/VisionFeedback';
import { getDatabase } from '../config/database';
import {
  FeedbackArtifactResult,
  VisionFeedbackArtifactRequestDetections,
  visionService,
  VisionFeedbackArtifactRequestCorrection,
} from './visionService';

type MulterFile = Express.Multer.File;

const ALLOWED_SOURCES = new Set(['rack', 'board']);
const ALLOWED_COLORS = new Set(['red', 'blue', 'yellow', 'black']);
const ALLOWED_CORRECTION_TYPES = new Set<VisionFeedbackCorrectionType>([
  'wrong_class',
  'wrong_bbox',
  'missing_tile',
  'false_positive',
  'added_tile',
  'removed_tile',
  'both',
]);
const DEFAULT_MODEL_VERSION = 'unknown';

interface SanitizedCorrection {
  feedbackHash: string;
  tileIndex: number;
  source: 'rack' | 'board';
  correctionType: VisionFeedbackCorrectionType;
  originalPrediction: VisionFeedbackTile | null;
  correctedTile: VisionFeedbackTile;
  confidence: number | null;
  bbox: VisionFeedbackBBox | null;
  finalImageDetections: Array<{
    tileIndex: number;
    bbox: VisionFeedbackBBox;
    correctedTile: VisionFeedbackTile;
  }>;
  classifierModelVersion: string;
  detectorModelVersion: string;
}

type SanitizedFinalDetection = {
  tileIndex: number;
  bbox: VisionFeedbackBBox;
  correctedTile: VisionFeedbackTile;
};

type SanitizedFinalDetectionMap = Record<'rack' | 'board', SanitizedFinalDetection[]>;

class VisionFeedbackService {
  private sanitizeModelVersion(modelVersion: unknown): string {
    if (typeof modelVersion !== 'string') {
      return DEFAULT_MODEL_VERSION;
    }

    const trimmed = modelVersion.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 200) : DEFAULT_MODEL_VERSION;
  }

  private sanitizeTile(tile: unknown): VisionFeedbackTile | null {
    if (!tile || typeof tile !== 'object') {
      return null;
    }

    const value = (tile as { value?: unknown }).value;
    const color = (tile as { color?: unknown }).color;
    const isJoker = (tile as { is_joker?: unknown }).is_joker;

    if (typeof isJoker !== 'boolean') {
      return null;
    }

    if (isJoker) {
      return {
        value: null,
        color: null,
        is_joker: true,
      };
    }

    if (
      typeof value !== 'number'
      || !Number.isInteger(value)
      || value < 1
      || value > 13
      || typeof color !== 'string'
      || !ALLOWED_COLORS.has(color)
    ) {
      return null;
    }

    return {
      value,
      color,
      is_joker: false,
    };
  }

  private sanitizeBBox(bbox: unknown): VisionFeedbackBBox | null {
    if (!bbox || typeof bbox !== 'object') {
      return null;
    }

    const x = Number((bbox as { x?: unknown }).x);
    const y = Number((bbox as { y?: unknown }).y);
    const width = Number((bbox as { width?: unknown }).width);
    const height = Number((bbox as { height?: unknown }).height);

    if (
      !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
      || width <= 0
      || height <= 0
    ) {
      return null;
    }

    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
    };
  }

  private tilesEqual(left: VisionFeedbackTile, right: VisionFeedbackTile): boolean {
    return (
      left.value === right.value
      && left.color === right.color
      && left.is_joker === right.is_joker
    );
  }

  private parsePayload(feedbackPayload: string | undefined): VisionFeedbackPayload {
    if (!feedbackPayload) {
      throw new Error('Feedback payload is required');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(feedbackPayload);
    } catch {
      throw new Error('Feedback payload must be valid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Feedback payload must be a JSON object');
    }

    const corrections = (parsed as { corrections?: unknown }).corrections;

    if (!Array.isArray(corrections)) {
      throw new Error('Feedback payload must include a corrections array');
    }

    return {
      corrections: corrections as VisionFeedbackCorrectionInput[],
      classifierModelVersion:
        (parsed as { classifierModelVersion?: unknown }).classifierModelVersion as string | undefined,
      detectorModelVersion:
        (parsed as { detectorModelVersion?: unknown }).detectorModelVersion as string | undefined,
      finalImageDetections:
        (parsed as { finalImageDetections?: unknown }).finalImageDetections as VisionFeedbackSourceDetections | undefined,
    };
  }

  private sanitizeFinalImageDetections(finalImageDetections: unknown): SanitizedFinalDetection[] {
    if (!Array.isArray(finalImageDetections)) {
      return [];
    }

    const sanitized = finalImageDetections.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const tileIndex = Number((item as { tileIndex?: unknown }).tileIndex);
      const bbox = this.sanitizeBBox((item as { bbox?: unknown }).bbox);
      const correctedTile = this.sanitizeTile((item as { correctedTile?: unknown }).correctedTile);

      if (!Number.isInteger(tileIndex) || tileIndex < 0 || !bbox || !correctedTile) {
        return [];
      }

      return [{
        tileIndex,
        bbox,
        correctedTile,
      }];
    });

    const byTileIndex = new Map<number, (typeof sanitized)[number]>();

    for (const item of sanitized) {
      byTileIndex.set(item.tileIndex, item);
    }

    return Array.from(byTileIndex.values()).sort((left, right) => left.tileIndex - right.tileIndex);
  }

  private sanitizePayloadFinalImageDetections(
    finalImageDetections: VisionFeedbackPayload['finalImageDetections']
  ): SanitizedFinalDetectionMap {
    return {
      rack: this.sanitizeFinalImageDetections(finalImageDetections?.rack),
      board: this.sanitizeFinalImageDetections(finalImageDetections?.board),
    };
  }

  private isMeaningfulCorrection(
    correctionType: VisionFeedbackCorrectionType,
    originalPrediction: VisionFeedbackTile | null,
    correctedTile: VisionFeedbackTile,
    finalImageDetections: Array<{
      tileIndex: number;
      bbox: VisionFeedbackBBox;
      correctedTile: VisionFeedbackTile;
    }>
  ): boolean {
    const tileChanged = originalPrediction
      ? !this.tilesEqual(originalPrediction, correctedTile)
      : true;

    switch (correctionType) {
      case 'wrong_class':
        return Boolean(originalPrediction) && tileChanged;
      case 'wrong_bbox':
      case 'both':
        return tileChanged || finalImageDetections.length > 0;
      case 'missing_tile':
      case 'false_positive':
      case 'added_tile':
      case 'removed_tile':
        return true;
      default:
        return false;
    }
  }

  private buildFeedbackHash(correction: Omit<SanitizedCorrection, 'feedbackHash'>): string {
    const serialized = JSON.stringify({
      source: correction.source,
      correctionType: correction.correctionType,
      originalPrediction: correction.originalPrediction,
      correctedTile: correction.correctedTile,
      bbox: correction.bbox,
      confidence: correction.confidence,
      finalImageDetections: correction.finalImageDetections,
      classifierModelVersion: correction.classifierModelVersion,
      detectorModelVersion: correction.detectorModelVersion,
    });

    return createHash('sha256').update(serialized).digest('hex');
  }

  private sanitizeCorrections(payload: VisionFeedbackPayload): {
    corrections: SanitizedCorrection[];
    finalImageDetectionsBySource: SanitizedFinalDetectionMap;
  } {
    const classifierModelVersion = this.sanitizeModelVersion(payload.classifierModelVersion);
    const detectorModelVersion = this.sanitizeModelVersion(payload.detectorModelVersion);
    const finalImageDetectionsBySource = this.sanitizePayloadFinalImageDetections(payload.finalImageDetections);

    const corrections = payload.corrections.flatMap((correction) => {
      if (!correction || typeof correction !== 'object') {
        return [];
      }

      const tileIndex = Number((correction as { tileIndex?: unknown }).tileIndex);
      const source = (correction as { source?: unknown }).source;
      const correctionType = (correction as { correctionType?: unknown }).correctionType;
      const confidence = Number((correction as { confidence?: unknown }).confidence);

      const originalPrediction = this.sanitizeTile(
        (correction as { originalPrediction?: unknown }).originalPrediction
      );
      const correctedTile = this.sanitizeTile(
        (correction as { correctedTile?: unknown }).correctedTile
      );
      const bbox = this.sanitizeBBox((correction as { bbox?: unknown }).bbox);
      const correctionLevelFinalImageDetections = this.sanitizeFinalImageDetections(
        (correction as { finalImageDetections?: unknown }).finalImageDetections
      );
      const requiresDetectionMetadata = correctionType !== 'added_tile';
      const hasValidConfidence = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;

      if (
        !Number.isInteger(tileIndex)
        || tileIndex < 0
        || typeof source !== 'string'
        || !ALLOWED_SOURCES.has(source)
        || typeof correctionType !== 'string'
        || !ALLOWED_CORRECTION_TYPES.has(correctionType as VisionFeedbackCorrectionType)
        || !correctedTile
        || (requiresDetectionMetadata && (!hasValidConfidence || !originalPrediction || !bbox))
      ) {
        return [];
      }

      const finalImageDetections =
        finalImageDetectionsBySource[source as 'rack' | 'board'].length > 0
          ? finalImageDetectionsBySource[source as 'rack' | 'board']
          : correctionLevelFinalImageDetections;

      if (!this.isMeaningfulCorrection(
        correctionType as VisionFeedbackCorrectionType,
        originalPrediction,
        correctedTile,
        finalImageDetections
      )) {
        return [];
      }

      const sanitizedCorrection = {
        tileIndex,
        source: source as 'rack' | 'board',
        correctionType: correctionType as VisionFeedbackCorrectionType,
        originalPrediction,
        correctedTile,
        confidence: hasValidConfidence ? Math.round(confidence * 10000) / 10000 : null,
        bbox,
        finalImageDetections,
        classifierModelVersion,
        detectorModelVersion,
      };

      return [{
        ...sanitizedCorrection,
        feedbackHash: this.buildFeedbackHash(sanitizedCorrection),
      }];
    });

    return {
      corrections,
      finalImageDetectionsBySource,
    };
  }

  private toArtifactRequestCorrection(
    correction: SanitizedCorrection
  ): VisionFeedbackArtifactRequestCorrection {
    return {
      feedbackHash: correction.feedbackHash,
      tileIndex: correction.tileIndex,
      source: correction.source,
      correctionType: correction.correctionType,
      correctedTile: correction.correctedTile,
      bbox: correction.bbox || null,
    };
  }

  private toArtifactRequestDetections(
    finalImageDetectionsBySource: SanitizedFinalDetectionMap
  ): VisionFeedbackArtifactRequestDetections {
    return {
      rack: finalImageDetectionsBySource.rack,
      board: finalImageDetectionsBySource.board,
    };
  }

  private buildArtifactLookup(artifactResults: FeedbackArtifactResult[]): Map<string, FeedbackArtifactResult> {
    return new Map(
      artifactResults.map((artifact) => [
        artifact.feedbackHash,
        artifact,
      ])
    );
  }

  async saveFeedback(
    feedbackPayload: string | undefined,
    rackImageFile?: MulterFile,
    boardImageFile?: MulterFile
  ): Promise<{ savedCount: number; skippedDuplicateCount: number }> {
    const payload = this.parsePayload(feedbackPayload);
    const { corrections, finalImageDetectionsBySource } = this.sanitizeCorrections(payload);

    if (corrections.length === 0) {
      return { savedCount: 0, skippedDuplicateCount: 0 };
    }

    const uniqueCorrections = new Map<string, SanitizedCorrection>();
    let skippedDuplicateCount = 0;

    for (const correction of corrections) {
      if (uniqueCorrections.has(correction.feedbackHash)) {
        skippedDuplicateCount += 1;
        continue;
      }

      uniqueCorrections.set(correction.feedbackHash, correction);
    }

    const uniqueCorrectionList = Array.from(uniqueCorrections.values());
    const db = getDatabase();
    const collection = db.collection<VisionFeedbackRecord>('vision_feedback');

    const existingHashes = new Set(
      (
        await collection
          .find(
            { feedbackHash: { $in: uniqueCorrectionList.map((item) => item.feedbackHash) } },
            { projection: { feedbackHash: 1 } }
          )
          .toArray()
      ).map((item: Pick<VisionFeedbackRecord, 'feedbackHash'>) => item.feedbackHash)
    );

    skippedDuplicateCount += existingHashes.size;

    const pendingCorrections = uniqueCorrectionList.filter(
      (correction) => !existingHashes.has(correction.feedbackHash)
    );

    if (pendingCorrections.length === 0) {
      return { savedCount: 0, skippedDuplicateCount };
    }

    let artifactLookup = new Map<string, FeedbackArtifactResult>();

    try {
      const artifactResults = await visionService.generateFeedbackArtifacts(
        pendingCorrections.map((correction) => this.toArtifactRequestCorrection(correction)),
        this.toArtifactRequestDetections(finalImageDetectionsBySource),
        rackImageFile,
        boardImageFile
      );
      artifactLookup = this.buildArtifactLookup(artifactResults);
    } catch (error: any) {
      console.warn('Feedback artifact generation failed:', error.message || error);
    }

    const records: VisionFeedbackRecord[] = pendingCorrections.map((correction) => {
      const artifact = artifactLookup.get(correction.feedbackHash);

      return {
        source: correction.source,
        correctionType: correction.correctionType,
        originalPrediction: correction.originalPrediction
          ? {
              ...correction.originalPrediction,
              confidence: correction.confidence ?? 0,
            }
          : null,
        correctedTile: correction.correctedTile,
        bbox: correction.bbox || null,
        savedImagePath: artifact?.savedImagePath || null,
        classifierModelVersion: correction.classifierModelVersion,
        detectorModelVersion: correction.detectorModelVersion,
        feedbackHash: correction.feedbackHash,
        reviewed: false,
        usedForTraining: false,
        createdAt: new Date(),
      };
    });

    const writeResult = await collection.bulkWrite(
      records.map((record) => ({
        updateOne: {
          filter: { feedbackHash: record.feedbackHash },
          update: { $setOnInsert: record },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    const savedCount = writeResult.upsertedCount;
    skippedDuplicateCount += records.length - savedCount;

    return { savedCount, skippedDuplicateCount };
  }
}

export const visionFeedbackService = new VisionFeedbackService();