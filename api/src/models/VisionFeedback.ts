import { ObjectId } from 'mongodb';

export type VisionFeedbackSource = 'rack' | 'board';

export type VisionFeedbackCorrectionType =
  | 'wrong_class'
  | 'wrong_bbox'
  | 'missing_tile'
  | 'false_positive'
  | 'added_tile'
  | 'removed_tile'
  | 'both';

export interface VisionFeedbackTile {
  value: number | null;
  color: string | null;
  is_joker: boolean;
}

export interface VisionFeedbackPrediction extends VisionFeedbackTile {
  confidence: number;
}

export interface VisionFeedbackBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionFeedbackCorrectionInput {
  tileIndex: number;
  source: VisionFeedbackSource;
  correctionType: VisionFeedbackCorrectionType;
  originalPrediction?: VisionFeedbackTile;
  correctedTile: VisionFeedbackTile;
  confidence?: number;
  bbox?: VisionFeedbackBBox;
  finalImageDetections?: Array<{
    tileIndex: number;
    bbox: VisionFeedbackBBox;
    correctedTile: VisionFeedbackTile;
  }>;
}

export interface VisionFeedbackSourceDetections {
  rack?: Array<{
    tileIndex: number;
    bbox: VisionFeedbackBBox;
    correctedTile: VisionFeedbackTile;
  }>;
  board?: Array<{
    tileIndex: number;
    bbox: VisionFeedbackBBox;
    correctedTile: VisionFeedbackTile;
  }>;
}

export interface VisionFeedbackPayload {
  corrections: VisionFeedbackCorrectionInput[];
  classifierModelVersion?: string;
  detectorModelVersion?: string;
  finalImageDetections?: VisionFeedbackSourceDetections;
}

export interface VisionFeedbackRecord {
  _id?: ObjectId;
  source: VisionFeedbackSource;
  correctionType: VisionFeedbackCorrectionType;
  originalPrediction: VisionFeedbackPrediction | null;
  correctedTile: VisionFeedbackTile;
  bbox: VisionFeedbackBBox | null;
  savedImagePath: string | null;
  classifierModelVersion: string;
  detectorModelVersion: string;
  feedbackHash: string;
  reviewed: boolean;
  usedForTraining: boolean;
  createdAt: Date;
}