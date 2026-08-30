import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { normalizeUploadedImage } from './imageNormalizationService';

type MulterFile = Express.Multer.File;

// Base URL of the Python Vision service
const VISION_SERVER_URL =
  process.env.VISION_SERVER_URL || 'http://localhost:8000';

export interface VisionFeedbackArtifactRequestCorrection {
  feedbackHash: string;
  tileIndex: number;
  source: 'rack' | 'board';
  correctionType:
    | 'wrong_class'
    | 'wrong_bbox'
    | 'missing_tile'
    | 'false_positive'
    | 'added_tile'
    | 'removed_tile'
    | 'both';
  correctedTile: {
    value: number | null;
    color: string | null;
    is_joker: boolean;
  };
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface VisionFeedbackArtifactRequestDetections {
  rack?: Array<{
    tileIndex: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    correctedTile: {
      value: number | null;
      color: string | null;
      is_joker: boolean;
    };
  }>;
  board?: Array<{
    tileIndex: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    correctedTile: {
      value: number | null;
      color: string | null;
      is_joker: boolean;
    };
  }>;
}

export interface FeedbackArtifactResult {
  feedbackHash: string;
  source: 'rack' | 'board';
  savedImagePath: string | null;
}

class VisionService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: VISION_SERVER_URL,
      timeout: 60000, // Vision processing may take longer
    });
  }

  private formatVisionAnalyzeError(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (error.code === 'ECONNREFUSED') {
      return 'Vision service is unavailable';
    }

    if (error.code === 'ECONNABORTED') {
      return 'Vision service timed out';
    }

    return error.message || 'Failed to analyze boards';
  }

  async generateFeedbackArtifacts(
    corrections: VisionFeedbackArtifactRequestCorrection[],
    finalImageDetections: VisionFeedbackArtifactRequestDetections,
    rackImageFile?: MulterFile,
    boardImageFile?: MulterFile
  ): Promise<FeedbackArtifactResult[]> {
    if (corrections.length === 0) {
      return [];
    }

    const formData = new FormData();
    formData.append('feedback', JSON.stringify({ corrections, finalImageDetections }));

    const normalizedRackImageFile = await normalizeUploadedImage(
      rackImageFile,
      'rack-feedback'
    );
    const normalizedBoardImageFile = await normalizeUploadedImage(
      boardImageFile,
      'board-feedback'
    );

    if (normalizedRackImageFile) {
      formData.append('rackImage', normalizedRackImageFile.buffer, {
        filename: normalizedRackImageFile.originalname || 'rack-feedback.jpg',
        contentType: normalizedRackImageFile.mimetype,
      });
    }

    if (normalizedBoardImageFile) {
      formData.append('boardImage', normalizedBoardImageFile.buffer, {
        filename: normalizedBoardImageFile.originalname || 'board-feedback.jpg',
        contentType: normalizedBoardImageFile.mimetype,
      });
    }

    const response = await this.api.post('/feedback/artifacts', formData, {
      headers: formData.getHeaders(),
    });

    return response.data.artifacts || [];
  }

  /**
   * Check if the Vision service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Analyze both "myBoard" and "sharedBoard" images
   *
   * This function:
   * 1. Validates input
   * 2. Sends images to Vision service
   * 3. Aggregates results into a single response
   */
async analyzeBoards(
  myBoardFile: MulterFile | undefined,
  sharedBoardFile: MulterFile | undefined
): Promise<any> {
  try {
    if (!myBoardFile && !sharedBoardFile) {
      return {
        success: false,
        message: 'At least one board image is required',
        data: null,
      };
    }

    const [normalizedMyBoardFile, normalizedSharedBoardFile] = await Promise.all([
      normalizeUploadedImage(myBoardFile, 'myBoard'),
      normalizeUploadedImage(sharedBoardFile, 'sharedBoard'),
    ]);

    const formData = new FormData();

    if (normalizedMyBoardFile) {
      formData.append('myBoard', normalizedMyBoardFile.buffer, {
        filename: normalizedMyBoardFile.originalname || 'myBoard.jpg',
        contentType: normalizedMyBoardFile.mimetype,
      });
    }

    if (normalizedSharedBoardFile) {
      formData.append('sharedBoard', normalizedSharedBoardFile.buffer, {
        filename: normalizedSharedBoardFile.originalname || 'sharedBoard.jpg',
        contentType: normalizedSharedBoardFile.mimetype,
      });
    }

    const response = await this.api.post('/analyze', formData, {
      headers: formData.getHeaders(),
    });

    return {
      success: true,
      message: 'Boards analyzed successfully',
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: this.formatVisionAnalyzeError(error),
      data: null,
    };
   }
  }
}

// Export singleton instance
export const visionService = new VisionService();