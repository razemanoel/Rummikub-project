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
  ): Promise<BoardAnalysisResponse> {
    try {
      // Ensure at least one image is provided
      if (!myBoardFile && !sharedBoardFile) {
        return {
          success: false,
          message: 'At least one board image is required',
          data: {
            myBoardDetections: null,
            sharedBoardDetections: null,
          },
        };
      }

      // Optional: check Vision service health before processing
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        throw new Error('Vision server is not responding');
      }

      /**
       * Process both images in parallel
       * If one image is missing, resolve with null
       */
      const results = await Promise.all([
        myBoardFile
          ? this.classifyTiles(
              myBoardFile.buffer,
              myBoardFile.originalname,
              myBoardFile.mimetype
            )
          : Promise.resolve(null),

        sharedBoardFile
          ? this.classifyTiles(
              sharedBoardFile.buffer,
              sharedBoardFile.originalname,
              sharedBoardFile.mimetype
            )
          : Promise.resolve(null),
      ]);

      const [myBoardResult, sharedBoardResult] = results;

      return {
        success: true,
        message: 'Boards analyzed successfully',
        data: {
          myBoardDetections: myBoardResult?.tiles || null,
          sharedBoardDetections: sharedBoardResult?.tiles || null,
        },
      };
    } catch (error: any) {
      console.error('Board analysis failed:', error.message);

      return {
        success: false,
        message: error.message || 'Failed to analyze boards',
        data: {
          myBoardDetections: null,
          sharedBoardDetections: null,
        },
      };
    }
  }
}

// Export singleton instance
export const visionService = new VisionService();