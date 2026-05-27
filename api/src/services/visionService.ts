import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

type MulterFile = Express.Multer.File;

// Base URL of the Python Vision service
const VISION_SERVER_URL =
  process.env.VISION_SERVER_URL || 'http://localhost:8000';

/**
 * Represents a detected Rummikub tile
 */
export interface TileDetection {
  tile_number: number | null;
  tile_color: string;
  confidence: number;
}

/**
 * Response from Vision server for a single image
 */
export interface VisionAnalysisResult {
  status: string;
  message: string;
  tiles: TileDetection[] | null;
}

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
  affectsClassifier: boolean;
  affectsDetector: boolean;
  correctedTile: {
    value: number | null;
    color: string | null;
    is_joker: boolean;
  };
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  tileIndex: number;
  source: 'rack' | 'board';
  imageCropPath: string | null;
  fullImagePath: string | null;
  yoloLabelPath: string | null;
}

/**
 * Combined response returned to the mobile client
 */
export interface BoardAnalysisResponse {
  success: boolean;
  message: string;
  data: {
    myBoardDetections: TileDetection[] | null;
    sharedBoardDetections: TileDetection[] | null;
  };
}

class VisionService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: VISION_SERVER_URL,
      timeout: 60000, // Vision processing may take longer
    });
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

    if (rackImageFile) {
      formData.append('rackImage', rackImageFile.buffer, {
        filename: rackImageFile.originalname || 'rack-feedback.jpg',
        contentType: rackImageFile.mimetype,
      });
    }

    if (boardImageFile) {
      formData.append('boardImage', boardImageFile.buffer, {
        filename: boardImageFile.originalname || 'board-feedback.jpg',
        contentType: boardImageFile.mimetype,
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
      console.error('Vision server health check failed:', error);
      return false;
    }
  }

  /**
   * Send a single image to the Vision server for tile classification
   *
   * @param fileBuffer - Buffer of the uploaded image (from multer)
   * @param filename - Original filename
   * @param mimetype - Actual MIME type (e.g., image/jpeg, image/png)
   */
  private async classifyTiles(
    fileBuffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<VisionAnalysisResult> {
    try {
      const formData = new FormData();

      // Important: use the real mimetype instead of hardcoding JPEG
      formData.append('file', fileBuffer, {
        filename: filename || 'image.jpg',
        contentType: mimetype,
      });

      const response = await this.api.post<VisionAnalysisResult>(
        '/classify-tiles',
        formData,
        {
          headers: formData.getHeaders(),
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to classify tiles:', error.message);

      throw new Error(
        `Vision server error: ${
          error.response?.data?.message || error.message
        }`
      );
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

    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      throw new Error('Vision server is not responding');
    }

    const formData = new FormData();

    if (myBoardFile) {
      formData.append('myBoard', myBoardFile.buffer, {
        filename: myBoardFile.originalname || 'myBoard.jpg',
        contentType: myBoardFile.mimetype,
      });
    }

    if (sharedBoardFile) {
      formData.append('sharedBoard', sharedBoardFile.buffer, {
        filename: sharedBoardFile.originalname || 'sharedBoard.jpg',
        contentType: sharedBoardFile.mimetype,
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
    console.error('Board analysis failed:', error.message);

    return {
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        'Failed to analyze boards',
      data: null,
    };
   }
  }
}

// Export singleton instance
export const visionService = new VisionService();