<?php

namespace App\Services;

use Aws\Rekognition\RekognitionClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Log;

class RekognitionService
{
    private ?RekognitionClient $client = null;
    private array $config;
    private string $driver;
    private string $collectionId;
    private float $matchThreshold;
    private float $qualityThreshold;

    public function __construct()
    {
        $this->config = config('services.rekognition', []);
        $this->driver = strtolower($this->config['driver'] ?? 'auto');
        $this->collectionId = $this->config['collection_id'] ?? 'campusvote-voters';
        $this->matchThreshold = (float) ($this->config['match_threshold'] ?? 80);
        $this->qualityThreshold = (float) ($this->config['quality_threshold'] ?? 70);
    }

    /**
     * Determine if real (non-placeholder) AWS credentials are configured.
     */
    public function hasValidAwsCredentials(): bool
    {
        $key = trim($this->config['key'] ?? '');
        $secret = trim($this->config['secret'] ?? '');

        if (empty($key) || empty($secret)) {
            return false;
        }

        $placeholders = [
            'your_actual_access_key',
            'your_actual_secret_key',
            'your_aws_access_key',
            'your_aws_secret_key',
            'your_access_key',
            'your_secret_key',
            'null',
            'none',
        ];

        if (in_array(strtolower($key), $placeholders) || in_array(strtolower($secret), $placeholders)) {
            return false;
        }

        if (strlen($key) < 16 || strlen($secret) < 16) {
            return false;
        }

        return true;
    }

    /**
     * Check if AWS mode should be attempted.
     */
    public function isAwsMode(): bool
    {
        if ($this->driver === 'local') {
            return false;
        }

        if ($this->driver === 'rekognition') {
            return true;
        }

        // 'auto' mode: only attempt AWS if credentials look real
        return $this->hasValidAwsCredentials();
    }

    /**
     * Get or initialize the RekognitionClient instance.
     */
    public function getClient(): ?RekognitionClient
    {
        if ($this->client === null && $this->isAwsMode()) {
            $this->client = new RekognitionClient([
                'version' => 'latest',
                'region' => $this->config['region'] ?? 'ap-southeast-1',
                'credentials' => [
                    'key' => $this->config['key'] ?? '',
                    'secret' => $this->config['secret'] ?? '',
                ],
            ]);
        }

        return $this->client;
    }

    /**
     * Create the Rekognition Collection if it doesn't already exist (idempotent).
     */
    public function ensureCollectionExists(): array
    {
        if (!$this->isAwsMode()) {
            return [
                'exists' => true,
                'created' => false,
                'collection_id' => 'local',
                'face_count' => 0,
                'arn' => 'local',
                'mode' => 'local',
            ];
        }

        try {
            $client = $this->getClient();
            $result = $client->describeCollection([
                'CollectionId' => $this->collectionId,
            ]);

            Log::info('Rekognition collection already exists', [
                'collection_id' => $this->collectionId,
                'face_count' => $result['FaceCount'] ?? 0,
            ]);

            return [
                'exists' => true,
                'created' => false,
                'collection_id' => $this->collectionId,
                'face_count' => $result['FaceCount'] ?? 0,
                'arn' => $result['CollectionARN'] ?? null,
                'mode' => 'rekognition',
            ];
        } catch (AwsException $e) {
            if ($e->getAwsErrorCode() === 'ResourceNotFoundException') {
                Log::info('Creating Rekognition collection', [
                    'collection_id' => $this->collectionId,
                ]);

                $client = $this->getClient();
                $result = $client->createCollection([
                    'CollectionId' => $this->collectionId,
                ]);

                return [
                    'exists' => false,
                    'created' => true,
                    'collection_id' => $this->collectionId,
                    'arn' => $result['CollectionArn'] ?? null,
                    'mode' => 'rekognition',
                ];
            }

            Log::error('Failed to describe/create Rekognition collection', [
                'error' => $e->getMessage(),
                'code' => $e->getAwsErrorCode(),
            ]);

            throw $e;
        }
    }

    /**
     * Pre-flight face detection: verifies an image contains exactly one face
     * and that its quality meets minimum thresholds.
     */
    /**
     * Pre-flight face detection: verifies an image contains exactly one face
     * and that its quality meets minimum thresholds (no face, blur, half-capture).
     */
    public function detectFaceQuality(string $imageBytes): array
    {
        if (!self::validateImageFormat($imageBytes)) {
            return [
                'hasFace' => false,
                'faceCount' => 0,
                'isBlurry' => false,
                'isHalfCaptured' => false,
                'quality' => ['brightness' => 0, 'sharpness' => 0],
                'confidence' => 0,
                'boundingBox' => null,
                'error_code' => 'invalid_format',
                'error' => 'Invalid image format. Please use JPEG or PNG.',
                'mode' => $this->getActiveDriver(),
            ];
        }

        // Try AWS Rekognition if AWS mode is enabled
        if ($this->isAwsMode()) {
            try {
                $client = $this->getClient();
                $result = $client->detectFaces([
                    'Image' => ['Bytes' => $imageBytes],
                    'Attributes' => ['ALL'],
                ]);

                $faces = $result['FaceDetails'] ?? [];
                $faceCount = count($faces);

                if ($faceCount === 0) {
                    return [
                        'hasFace' => false,
                        'faceCount' => 0,
                        'isBlurry' => false,
                        'isHalfCaptured' => false,
                        'quality' => ['brightness' => 0, 'sharpness' => 0],
                        'confidence' => 0,
                        'boundingBox' => null,
                        'error_code' => 'no_face_detected',
                        'error' => 'No face detected in the image. Please position your face clearly in the camera.',
                        'mode' => 'rekognition',
                    ];
                }

                if ($faceCount > 1) {
                    return [
                        'hasFace' => true,
                        'faceCount' => $faceCount,
                        'isBlurry' => false,
                        'isHalfCaptured' => false,
                        'quality' => ['brightness' => 0, 'sharpness' => 0],
                        'confidence' => 0,
                        'boundingBox' => null,
                        'error_code' => 'multiple_faces',
                        'error' => 'Multiple faces detected. Please ensure only one person is in front of the camera.',
                        'mode' => 'rekognition',
                    ];
                }

                $face = $faces[0];
                $brightness = round($face['Quality']['Brightness'] ?? 0, 2);
                $sharpness = round($face['Quality']['Sharpness'] ?? 0, 2);
                $confidence = round($face['Confidence'] ?? 0, 2);
                $box = $face['BoundingBox'] ?? null;
                $pose = $face['Pose'] ?? [];

                $yaw = abs($pose['Yaw'] ?? 0);
                $pitch = abs($pose['Pitch'] ?? 0);
                $roll = abs($pose['Roll'] ?? 0);

                // Boundary clipping / half-capture checks
                $isCutOff = false;
                if ($box) {
                    $left = $box['Left'] ?? 0;
                    $top = $box['Top'] ?? 0;
                    $width = $box['Width'] ?? 0;
                    $height = $box['Height'] ?? 0;

                    // Face touches or exceeds the frame edge (cut off)
                    if ($left < 0.03 || ($left + $width) > 0.97 || $top < 0.03 || ($top + $height) > 0.97) {
                        $isCutOff = true;
                    }

                    // Face is too far away (tiny fraction of frame) or too close (clipping)
                    if ($width < 0.18 || $height < 0.20 || $width > 0.88 || $height > 0.92) {
                        $isCutOff = true;
                    }
                }

                $isSideAngle = ($yaw > 25) || ($pitch > 25) || ($roll > 25);
                $isHalfCaptured = $isCutOff || $isSideAngle;
                $isBlurry = $sharpness < $this->qualityThreshold;

                $errorCode = null;
                $errorMessage = null;

                if ($confidence < 80) {
                    $errorCode = 'no_face_detected';
                    $errorMessage = 'Clear face could not be detected. Please face the camera directly.';
                } elseif ($isHalfCaptured) {
                    $errorCode = 'half_face_detected';
                    $errorMessage = 'Face is only partially captured or cut off. Please center your full face inside the oval frame.';
                } elseif ($isBlurry) {
                    $errorCode = 'face_blurred';
                    $errorMessage = "Image is blurry (sharpness: {$sharpness}%). Please hold your device steady and ensure good lighting.";
                } elseif ($brightness < 35 || $brightness > 92) {
                    $errorCode = 'poor_lighting';
                    $errorMessage = 'Lighting is too dark or washed out. Please adjust your position.';
                }

                return [
                    'hasFace' => $confidence >= 80,
                    'faceCount' => 1,
                    'isBlurry' => $isBlurry,
                    'isHalfCaptured' => $isHalfCaptured,
                    'quality' => [
                        'brightness' => $brightness,
                        'sharpness' => $sharpness,
                    ],
                    'confidence' => $confidence,
                    'boundingBox' => $box ? [
                        'left' => $box['Left'],
                        'top' => $box['Top'],
                        'width' => $box['Width'],
                        'height' => $box['Height'],
                    ] : null,
                    'error_code' => $errorCode,
                    'error' => $errorMessage,
                    'mode' => 'rekognition',
                ];
            } catch (AwsException $e) {
                Log::warning('AWS Rekognition detectFaces failed, falling back to local analysis', [
                    'error' => $e->getMessage(),
                    'code' => $e->getAwsErrorCode(),
                ]);

                if ($this->driver === 'rekognition') {
                    throw $e;
                }
                // In 'auto' mode: fall through to local analysis
            }
        }

        // Local face & quality analysis
        return $this->detectLocalFaceQuality($imageBytes);
    }

    /**
     * Local face detection, blur analysis, and half-capture detection using GD.
     */
    private function detectLocalFaceQuality(string $imageBytes): array
    {
        $len = strlen($imageBytes);
        // Genuine photo captures from mobile are typically >= 4KB
        if ($len < 4000 || !function_exists('imagecreatefromstring')) {
            return [
                'hasFace' => false,
                'faceCount' => 0,
                'isBlurry' => false,
                'isHalfCaptured' => false,
                'quality' => ['brightness' => 0, 'sharpness' => 0],
                'confidence' => 0,
                'boundingBox' => null,
                'error_code' => 'no_face_detected',
                'error' => 'No face detected. Please position your face clearly in the camera.',
                'mode' => 'local',
            ];
        }

        $srcImg = @imagecreatefromstring($imageBytes);
        if (!$srcImg) {
            return [
                'hasFace' => false,
                'faceCount' => 0,
                'isBlurry' => false,
                'isHalfCaptured' => false,
                'quality' => ['brightness' => 0, 'sharpness' => 0],
                'confidence' => 0,
                'boundingBox' => null,
                'error_code' => 'no_face_detected',
                'error' => 'Could not process image. Please try again.',
                'mode' => 'local',
            ];
        }

        $srcW = imagesx($srcImg);
        $srcH = imagesy($srcImg);

        if ($srcW < 80 || $srcH < 80) {
            imagedestroy($srcImg);
            return [
                'hasFace' => false,
                'faceCount' => 0,
                'isBlurry' => true,
                'isHalfCaptured' => true,
                'quality' => ['brightness' => 0, 'sharpness' => 0],
                'confidence' => 0,
                'boundingBox' => null,
                'error_code' => 'no_face_detected',
                'error' => 'Image resolution is too low.',
                'mode' => 'local',
            ];
        }

        // Downsample to 120x120 for fast and standardized spatial metric analysis
        $targetSize = 120;
        $workImg = imagecreatetruecolor($targetSize, $targetSize);
        imagecopyresampled($workImg, $srcImg, 0, 0, 0, 0, $targetSize, $targetSize, $srcW, $srcH);
        imagedestroy($srcImg);

        // Build Luminance & Chrominance (YCbCr) maps
        $lumMap = [];
        $skinMask = [];
        $totalLum = 0.0;
        $skinPixelCount = 0;
        $centerSkinCount = 0;
        $leftSkinCount = 0;
        $rightSkinCount = 0;
        $topSkinCount = 0;
        $bottomSkinCount = 0;

        $minSkinX = $targetSize;
        $maxSkinX = 0;
        $minSkinY = $targetSize;
        $maxSkinY = 0;

        $centerMin = (int) ($targetSize * 0.20);
        $centerMax = (int) ($targetSize * 0.80);
        $midX = (int) ($targetSize / 2);
        $midY = (int) ($targetSize / 2);

        $sumSkinX = 0;
        $sumSkinY = 0;

        for ($y = 0; $y < $targetSize; $y++) {
            $lumMap[$y] = [];
            $skinMask[$y] = [];
            for ($x = 0; $x < $targetSize; $x++) {
                $rgb = imagecolorat($workImg, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;

                // ITU-R BT.601 Luminance
                $lum = (0.299 * $r) + (0.587 * $g) + (0.114 * $b);
                $lumMap[$y][$x] = $lum;
                $totalLum += $lum;

                // Chrominance Cb & Cr
                $cb = 128.0 - (0.168736 * $r) - (0.331264 * $g) + (0.5 * $b);
                $cr = 128.0 + (0.5 * $r) - (0.418688 * $g) - (0.081312 * $b);

                // Universal human skin locus (YCbCr + RGB chromaticity)
                $isSkin = ($cb >= 65.0 && $cb <= 142.0 && $cr >= 126.0 && $cr <= 184.0)
                    && ($r > $b) && ($g > 15) && (($r - $g) >= 1 || $cr >= 130);

                $skinMask[$y][$x] = $isSkin;

                if ($isSkin) {
                    $skinPixelCount++;
                    $sumSkinX += $x;
                    $sumSkinY += $y;

                    if ($x < $minSkinX) $minSkinX = $x;
                    if ($x > $maxSkinX) $maxSkinX = $x;
                    if ($y < $minSkinY) $minSkinY = $y;
                    if ($y > $maxSkinY) $maxSkinY = $y;

                    if ($x >= $centerMin && $x <= $centerMax && $y >= $centerMin && $y <= $centerMax) {
                        $centerSkinCount++;
                    }

                    if ($x < $midX) $leftSkinCount++;
                    else $rightSkinCount++;

                    if ($y < $midY) $topSkinCount++;
                    else $bottomSkinCount++;
                }
            }
        }

        $totalPixels = $targetSize * $targetSize;
        $centerPixels = ($centerMax - $centerMin + 1) * ($centerMax - $centerMin + 1);
        $avgLum = $totalLum / $totalPixels;

        // Brightness Evaluation
        if ($avgLum < 30) {
            $brightness = ($avgLum / 30.0) * 45.0; // too dark
        } elseif ($avgLum > 235) {
            $brightness = max(10.0, 100.0 - (($avgLum - 235.0) / 20.0) * 80.0); // overexposed
        } else {
            $brightness = 78.0 + (sin(($avgLum - 30) / 205.0 * M_PI) * 18.0);
        }

        // Laplacian Variance & Sobel Gradient for Sharpness / Blur Detection
        $laplacianVals = [];
        $totalLaplacian = 0.0;
        $totalGradient = 0.0;
        $gradSamples = 0;

        for ($y = 1; $y < $targetSize - 1; $y++) {
            for ($x = 1; $x < $targetSize - 1; $x++) {
                // Discrete 4-neighbor Laplacian
                $lap = $lumMap[$y][$x + 1] + $lumMap[$y][$x - 1]
                     + $lumMap[$y + 1][$x] + $lumMap[$y - 1][$x]
                     - (4.0 * $lumMap[$y][$x]);

                $laplacianVals[] = $lap;
                $totalLaplacian += $lap;

                // Sobel gradient magnitude
                $gx = abs($lumMap[$y][$x + 1] - $lumMap[$y][$x - 1]);
                $gy = abs($lumMap[$y + 1][$x] - $lumMap[$y - 1][$x]);
                $totalGradient += ($gx + $gy);
                $gradSamples++;
            }
        }

        imagedestroy($workImg);

        $lapCount = count($laplacianVals);
        $meanLap = $lapCount > 0 ? ($totalLaplacian / $lapCount) : 0;
        $lapSumSq = 0.0;
        foreach ($laplacianVals as $val) {
            $lapSumSq += pow($val - $meanLap, 2);
        }
        $laplacianVariance = $lapCount > 0 ? ($lapSumSq / $lapCount) : 0;
        $avgGradient = $gradSamples > 0 ? ($totalGradient / $gradSamples) : 0;

        // Standard camera face photos have laplacian variance >= 60 and avgGradient >= 10
        // Blurry, out-of-focus, or motion-blurred photos have low variance (< 35) and low gradient (< 6.5)
        if ($laplacianVariance < 18.0) {
            $sharpness = ($laplacianVariance / 18.0) * 35.0; // severe blur
        } elseif ($laplacianVariance < 55.0) {
            $sharpness = 35.0 + (($laplacianVariance - 18.0) / 37.0) * 30.0; // moderate blur (35% - 65%)
        } else {
            $sharpness = min(98.0, 70.0 + (min(200.0, $laplacianVariance) / 200.0) * 26.0); // sharp (70% - 96%)
        }

        // Eye / Feature contrast check within upper-middle face
        $featureContrast = 0.0;
        $eyeZoneContrast = 0.0;
        for ($y = (int)($targetSize * 0.30); $y < (int)($targetSize * 0.55); $y++) {
            for ($x = (int)($targetSize * 0.25); $x < (int)($targetSize * 0.75); $x++) {
                $eyeZoneContrast += abs($lumMap[$y][$x] - $avgLum);
            }
        }
        $eyeZoneSamples = ((int)($targetSize * 0.55) - (int)($targetSize * 0.30)) * ((int)($targetSize * 0.75) - (int)($targetSize * 0.25));
        $avgEyeContrast = $eyeZoneSamples > 0 ? ($eyeZoneContrast / $eyeZoneSamples) : 0;

        // Center skin ratio
        $centerSkinRatio = $centerPixels > 0 ? ($centerSkinCount / $centerPixels) : 0;
        $totalSkinRatio = $totalPixels > 0 ? ($skinPixelCount / $totalPixels) : 0;

        // 1. NO FACE DETECTED CHECKS:
        // A genuine face must have decent skin presence in the center region and natural feature contrast
        $hasFace = true;
        $noFaceReason = null;

        if ($centerSkinRatio < 0.03 && $totalSkinRatio < 0.03) {
            $hasFace = false;
            $noFaceReason = 'No face detected. Please position your face clearly within the oval guide.';
        } elseif ($centerSkinRatio > 0.92 && $avgEyeContrast < 8.0) {
            // Screen or camera completely covered by finger/solid uniform color
            $hasFace = false;
            $noFaceReason = 'Camera appears obstructed. Please remove any obstruction and face the camera.';
        } elseif ($avgEyeContrast < 5.0 && $laplacianVariance < 20.0) {
            // Flat, non-face surface (desk, wall, blank paper)
            $hasFace = false;
            $noFaceReason = 'No face detected. Please position your face clearly within the camera frame.';
        }

        // 2. HALF CAPTURE / PARTIAL FACE CHECKS:
        $isHalfCaptured = false;
        $halfCaptureReason = null;

        if ($hasFace && $skinPixelCount > 0) {
            $normMinX = $minSkinX / (float) $targetSize;
            $normMaxX = $maxSkinX / (float) $targetSize;
            $normMinY = $minSkinY / (float) $targetSize;
            $normMaxY = $maxSkinY / (float) $targetSize;

            $centerX = $sumSkinX / (float) ($skinPixelCount * $targetSize);
            $centerY = $sumSkinY / (float) ($skinPixelCount * $targetSize);

            // Left edge cut off: skin touches left edge while right side is empty
            if ($normMinX <= 0.04 && $normMaxX < 0.62) {
                $isHalfCaptured = true;
                $halfCaptureReason = 'Face is cut off on the left. Please center your full face in the oval frame.';
            }
            // Right edge cut off: skin touches right edge while left side is empty
            elseif ($normMaxX >= 0.96 && $normMinX > 0.38) {
                $isHalfCaptured = true;
                $halfCaptureReason = 'Face is cut off on the right. Please center your full face in the oval frame.';
            }
            // Top cut off: forehead or upper face cut off
            elseif ($normMinY <= 0.03 && $normMaxY < 0.58) {
                $isHalfCaptured = true;
                $halfCaptureReason = 'Top of head or forehead is cut off. Please tilt your camera to show your full face.';
            }
            // Bottom cut off: chin or lower face cut off
            elseif ($normMaxY >= 0.97 && $normMinY > 0.42) {
                $isHalfCaptured = true;
                $halfCaptureReason = 'Bottom of face or chin is cut off. Please position your full face in the frame.';
            }
            // Off-center center of mass (> 22% away from center)
            elseif (abs($centerX - 0.5) > 0.22 || abs($centerY - 0.5) > 0.25) {
                $isHalfCaptured = true;
                $halfCaptureReason = 'Face is not centered. Please position your face inside the oval frame.';
            }
            // Severe side-angle / half-profile (one side has > 2.8x more skin than the other)
            elseif ($leftSkinCount > 0 && $rightSkinCount > 0) {
                $symRatio = max($leftSkinCount, $rightSkinCount) / (float) min($leftSkinCount, $rightSkinCount);
                if ($symRatio > 2.8) {
                    $isHalfCaptured = true;
                    $halfCaptureReason = 'Face is turned sideways. Please look straight at the camera with a neutral expression.';
                }
            }
            // Missing vertical balance (e.g. only mouth or only forehead visible)
            if ($topSkinCount > 0 && $bottomSkinCount > 0) {
                $vertRatio = max($topSkinCount, $bottomSkinCount) / (float) min($topSkinCount, $bottomSkinCount);
                if ($vertRatio > 3.8) {
                    $isHalfCaptured = true;
                    $halfCaptureReason = 'Partial face captured. Please ensure your entire face is visible from forehead to chin.';
                }
            }
        }

        // 3. BLUR CHECK:
        $isBlurry = $sharpness < $this->qualityThreshold;

        $errorCode = null;
        $errorMessage = null;

        if (!$hasFace) {
            $errorCode = 'no_face_detected';
            $errorMessage = $noFaceReason ?: 'No face detected. Please position your face clearly in the camera.';
        } elseif ($isHalfCaptured) {
            $errorCode = 'half_face_detected';
            $errorMessage = $halfCaptureReason ?: 'Face is only partially captured. Please center your full face inside the oval frame.';
        } elseif ($isBlurry) {
            $errorCode = 'face_blurred';
            $errorMessage = 'Face is blurry. Please hold steady and ensure good lighting.';
        } elseif ($brightness < 35 || $brightness > 92) {
            $errorCode = 'poor_lighting';
            $errorMessage = 'Lighting is too dark or washed out. Please move to a well-lit area.';
        }

        $boxWidth = max(0.1, ($maxSkinX - $minSkinX) / (float) $targetSize);
        $boxHeight = max(0.1, ($maxSkinY - $minSkinY) / (float) $targetSize);

        return [
            'hasFace' => $hasFace,
            'faceCount' => $hasFace ? 1 : 0,
            'isBlurry' => $isBlurry,
            'isHalfCaptured' => $isHalfCaptured,
            'quality' => [
                'brightness' => round($brightness, 2),
                'sharpness' => round($sharpness, 2),
            ],
            'confidence' => $hasFace ? 95.0 : 0.0,
            'boundingBox' => $hasFace ? [
                'left' => round($minSkinX / (float) $targetSize, 2),
                'top' => round($minSkinY / (float) $targetSize, 2),
                'width' => round($boxWidth, 2),
                'height' => round($boxHeight, 2),
            ] : null,
            'error_code' => $errorCode,
            'error' => $errorMessage,
            'mode' => 'local',
        ];
    }

    /**
     * Enroll a voter's face into the collection (or local storage).
     */
    public function enrollFace(int $voterId, string $imageBytes): array
    {
        $externalImageId = "voter_{$voterId}";

        if ($this->isAwsMode()) {
            try {
                $client = $this->getClient();
                $result = $client->indexFaces([
                    'CollectionId' => $this->collectionId,
                    'Image' => ['Bytes' => $imageBytes],
                    'ExternalImageId' => $externalImageId,
                    'MaxFaces' => 1,
                    'QualityFilter' => 'AUTO',
                    'DetectionAttributes' => ['ALL'],
                ]);

                $indexedFaces = $result['FaceRecords'] ?? [];

                if (!empty($indexedFaces)) {
                    $faceRecord = $indexedFaces[0];
                    $faceId = $faceRecord['Face']['FaceId'];
                    $faceDetail = $faceRecord['FaceDetail'] ?? [];

                    $brightness = $faceDetail['Quality']['Brightness'] ?? 80;
                    $sharpness = $faceDetail['Quality']['Sharpness'] ?? 80;

                    Log::info('Rekognition face enrolled', [
                        'voter_id' => $voterId,
                        'face_id' => $faceId,
                        'brightness' => $brightness,
                        'sharpness' => $sharpness,
                    ]);

                    return [
                        'face_id' => $faceId,
                        'external_image_id' => $externalImageId,
                        'quality' => [
                            'brightness' => round($brightness, 2),
                            'sharpness' => round($sharpness, 2),
                        ],
                        'indexed' => true,
                        'mode' => 'rekognition',
                    ];
                }
            } catch (AwsException $e) {
                // If collection doesn't exist, create it and retry once
                if ($e->getAwsErrorCode() === 'ResourceNotFoundException') {
                    Log::info('Rekognition collection not found on indexFaces, creating and retrying...', [
                        'voter_id' => $voterId,
                    ]);
                    try {
                        $this->ensureCollectionExists();
                        return $this->enrollFace($voterId, $imageBytes);
                    } catch (\Exception $retryEx) {
                        Log::error('Collection creation retry failed', ['error' => $retryEx->getMessage()]);
                    }
                }

                Log::warning('Rekognition enrollFace failed, falling back to local enrollment', [
                    'voter_id' => $voterId,
                    'error' => $e->getMessage(),
                    'code' => $e->getAwsErrorCode(),
                ]);

                if ($this->driver === 'rekognition') {
                    throw $e;
                }
                // Fall through to local enrollment in auto mode
            }
        }

        // Local Enrollment
        $qualityInfo = $this->detectLocalFaceQuality($imageBytes);
        $faceId = "local_face_{$voterId}_" . bin2hex(random_bytes(8));

        Log::info('Local face enrolled', [
            'voter_id' => $voterId,
            'face_id' => $faceId,
            'brightness' => $qualityInfo['quality']['brightness'],
            'sharpness' => $qualityInfo['quality']['sharpness'],
        ]);

        return [
            'face_id' => $faceId,
            'external_image_id' => $externalImageId,
            'quality' => $qualityInfo['quality'],
            'indexed' => true,
            'mode' => 'local',
        ];
    }

    /**
     * Verify a captured face against the voter's enrolled profile.
     *
     * @param int $voterId The voter's database ID
     * @param string|null $storedFaceId The enrolled face_id (AWS UUID or local identifier)
     * @param string $imageBytes Raw captured image bytes
     * @param string|null $enrolledFaceData Stored base64 or raw face data for local verification
     * @return array{matched: bool, similarity: float, faceMatches: array, mode: string, error_code?: string|null, error?: string|null}
     */
    public function verifyFace(int $voterId, ?string $storedFaceId, string $imageBytes, ?string $enrolledFaceData = null): array
    {
        $isLocalFaceId = empty($storedFaceId) || str_starts_with($storedFaceId, 'local_');

        // Pre-flight check on current capture (reject if no face, blurry, or half-captured)
        $qualityCheck = $this->detectFaceQuality($imageBytes);
        if (!$qualityCheck['hasFace']) {
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => $this->getActiveDriver(),
                'error_code' => $qualityCheck['error_code'] ?? 'no_face_detected',
                'error' => $qualityCheck['error'] ?? 'No face detected in the image. Please position your face clearly.',
            ];
        }

        if ($qualityCheck['isHalfCaptured']) {
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => $this->getActiveDriver(),
                'error_code' => 'half_face_detected',
                'error' => $qualityCheck['error'] ?? 'Face is only partially captured or cut off. Please center your full face inside the oval frame.',
            ];
        }

        if ($qualityCheck['isBlurry']) {
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => $this->getActiveDriver(),
                'error_code' => 'face_blurred',
                'error' => $qualityCheck['error'] ?? 'Face is blurry. Please hold steady and ensure good lighting.',
            ];
        }

        // Try AWS Rekognition only if in AWS mode AND face was enrolled in AWS
        if ($this->isAwsMode() && !$isLocalFaceId) {
            try {
                $client = $this->getClient();

                // 1. First try direct 1-to-1 face comparison if enrolled photo is stored
                if (!empty($enrolledFaceData)) {
                    try {
                        $enrolledBytes = self::decodeImage($enrolledFaceData);
                        $compareResult = $client->compareFaces([
                            'SourceImage' => ['Bytes' => $enrolledBytes],
                            'TargetImage' => ['Bytes' => $imageBytes],
                            'SimilarityThreshold' => 50,
                        ]);

                        $matches = $compareResult['FaceMatches'] ?? [];
                        if (!empty($matches)) {
                            $similarity = round($matches[0]['Similarity'] ?? 0, 2);
                            $matched = $similarity >= $this->matchThreshold;

                            Log::info('Rekognition CompareFaces result', [
                                'voter_id' => $voterId,
                                'similarity' => $similarity,
                                'matched' => $matched,
                                'threshold' => $this->matchThreshold,
                            ]);

                            return [
                                'matched' => $matched,
                                'similarity' => $similarity,
                                'faceMatches' => [['face_id' => $storedFaceId, 'similarity' => $similarity]],
                                'mode' => 'rekognition',
                                'error_code' => $matched ? null : 'no_match',
                                'error' => $matched ? null : "Face does not match registered voter (similarity: {$similarity}%).",
                            ];
                        }
                    } catch (\Exception $compEx) {
                        Log::warning('Rekognition compareFaces fallback to searchFacesByImage', ['error' => $compEx->getMessage()]);
                    }
                }

                // 2. Search against Rekognition Collection
                $result = $client->searchFacesByImage([
                    'CollectionId' => $this->collectionId,
                    'Image' => ['Bytes' => $imageBytes],
                    'MaxFaces' => 10,
                    'FaceMatchThreshold' => 50,
                ]);

                $faceMatches = $result['FaceMatches'] ?? [];
                $ownMatch = null;

                foreach ($faceMatches as $match) {
                    if (($match['Face']['FaceId'] ?? null) === $storedFaceId) {
                        $ownMatch = $match;
                        break;
                    }
                }

                if ($ownMatch !== null) {
                    $similarity = round($ownMatch['Similarity'] ?? 0, 2);
                    $matched = $similarity >= $this->matchThreshold;

                    Log::info('Rekognition verify result', [
                        'voter_id' => $voterId,
                        'similarity' => $similarity,
                        'matched' => $matched,
                        'threshold' => $this->matchThreshold,
                    ]);

                    return [
                        'matched' => $matched,
                        'similarity' => $similarity,
                        'faceMatches' => array_map(fn($m) => [
                            'face_id' => $m['Face']['FaceId'] ?? null,
                            'similarity' => round($m['Similarity'] ?? 0, 2),
                        ], $faceMatches),
                        'mode' => 'rekognition',
                        'error_code' => $matched ? null : 'no_match',
                        'error' => $matched ? null : "Face does not match registered voter (similarity: {$similarity}%).",
                    ];
                }

                // If not matched in AWS collection
                Log::info('Rekognition verify: face did not match enrolled FaceId', [
                    'voter_id' => $voterId,
                    'stored_face_id' => $storedFaceId,
                    'total_matches' => count($faceMatches),
                ]);

                return [
                    'matched' => false,
                    'similarity' => 0.0,
                    'faceMatches' => [],
                    'mode' => 'rekognition',
                    'error_code' => 'no_match',
                    'error' => 'Face does not match registered voter. Please try again.',
                ];
            } catch (AwsException $e) {
                Log::warning('Rekognition verifyFace error, checking local fallback', [
                    'voter_id' => $voterId,
                    'error' => $e->getMessage(),
                    'code' => $e->getAwsErrorCode(),
                ]);

                if ($this->driver === 'rekognition') {
                    throw $e;
                }
                // Fall through to local verification if enrolled data is available
            }
        }

        // Local Verification
        return $this->verifyLocalFace($voterId, $imageBytes, $enrolledFaceData);
    }

    /**
     * Local face verification comparing current capture with enrolled face data using
     * multi-feature extraction (Local Binary Patterns, Spatial Gradient Maps, and Chrominance).
     */
    private function verifyLocalFace(int $voterId, string $capturedBytes, ?string $enrolledFaceData): array
    {
        if (empty($enrolledFaceData)) {
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => 'local',
                'error_code' => 'no_enrolled_data',
                'error' => 'No enrolled facial data available for comparison.',
            ];
        }

        // Decode enrolled face data
        try {
            $enrolledBytes = self::decodeImage($enrolledFaceData);
        } catch (\Exception $e) {
            $enrolledBytes = $enrolledFaceData;
        }

        // Exact match check (e.g. testing with identical photo bytes)
        if ($capturedBytes === $enrolledBytes || md5($capturedBytes) === md5($enrolledBytes)) {
            return [
                'matched' => true,
                'similarity' => 100.0,
                'faceMatches' => [['face_id' => "local_{$voterId}", 'similarity' => 100.0]],
                'mode' => 'local',
                'error_code' => null,
                'error' => null,
            ];
        }

        if (!function_exists('imagecreatefromstring')) {
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => 'local',
                'error_code' => 'server_error',
                'error' => 'Image processing library unavailable.',
            ];
        }

        $imgCap = @imagecreatefromstring($capturedBytes);
        $imgEnr = @imagecreatefromstring($enrolledBytes);

        if (!$imgCap || !$imgEnr) {
            if ($imgCap) imagedestroy($imgCap);
            if ($imgEnr) imagedestroy($imgEnr);
            return [
                'matched' => false,
                'similarity' => 0.0,
                'faceMatches' => [],
                'mode' => 'local',
                'error_code' => 'invalid_image',
                'error' => 'Could not decode images for comparison.',
            ];
        }

        // Standardize both images to 32x32 face patches for feature extraction
        $size = 32;
        $thumbCap = imagecreatetruecolor($size, $size);
        $thumbEnr = imagecreatetruecolor($size, $size);

        imagecopyresampled($thumbCap, $imgCap, 0, 0, 0, 0, $size, $size, imagesx($imgCap), imagesy($imgCap));
        imagecopyresampled($thumbEnr, $imgEnr, 0, 0, 0, 0, $size, $size, imagesx($imgEnr), imagesy($imgEnr));

        imagedestroy($imgCap);
        imagedestroy($imgEnr);

        // Extract Luminance, Gradients, and Chrominance (Cb, Cr)
        $lumCap = [];
        $lumEnr = [];
        $cbCap = []; $crCap = [];
        $cbEnr = []; $crEnr = [];

        for ($y = 0; $y < $size; $y++) {
            $lumCap[$y] = [];
            $lumEnr[$y] = [];
            $cbCap[$y] = []; $crCap[$y] = [];
            $cbEnr[$y] = []; $crEnr[$y] = [];

            for ($x = 0; $x < $size; $x++) {
                $rgb1 = imagecolorat($thumbCap, $x, $y);
                $r1 = ($rgb1 >> 16) & 0xFF; $g1 = ($rgb1 >> 8) & 0xFF; $b1 = $rgb1 & 0xFF;
                $lumCap[$y][$x] = (0.299 * $r1) + (0.587 * $g1) + (0.114 * $b1);
                $cbCap[$y][$x] = 128.0 - (0.168736 * $r1) - (0.331264 * $g1) + (0.5 * $b1);
                $crCap[$y][$x] = 128.0 + (0.5 * $r1) - (0.418688 * $g1) - (0.081312 * $b1);

                $rgb2 = imagecolorat($thumbEnr, $x, $y);
                $r2 = ($rgb2 >> 16) & 0xFF; $g2 = ($rgb2 >> 8) & 0xFF; $b2 = $rgb2 & 0xFF;
                $lumEnr[$y][$x] = (0.299 * $r2) + (0.587 * $g2) + (0.114 * $b2);
                $cbEnr[$y][$x] = 128.0 - (0.168736 * $r2) - (0.331264 * $g2) + (0.5 * $b2);
                $crEnr[$y][$x] = 128.0 + (0.5 * $r2) - (0.418688 * $g2) - (0.081312 * $b2);
            }
        }

        imagedestroy($thumbCap);
        imagedestroy($thumbEnr);

        // 1. Local Binary Patterns (LBP) Histogram Comparison (16 sub-regions)
        // Divide 32x32 into 4x4 grid of 8x8 cells. Compute 8-bin LBP for each cell.
        $gridCells = 4;
        $cellSize = 8;
        $totalLbpSimilarity = 0.0;

        for ($gy = 0; $gy < $gridCells; $gy++) {
            for ($gx = 0; $gx < $gridCells; $gx++) {
                $histCap = array_fill(0, 8, 0);
                $histEnr = array_fill(0, 8, 0);

                $startX = $gx * $cellSize;
                $startY = $gy * $cellSize;

                for ($y = $startY + 1; $y < $startY + $cellSize - 1; $y++) {
                    for ($x = $startX + 1; $x < $startX + $cellSize - 1; $x++) {
                        $c1 = $lumCap[$y][$x];
                        $c2 = $lumEnr[$y][$x];

                        // 8 neighbors
                        $neighbors1 = [
                            $lumCap[$y-1][$x-1], $lumCap[$y-1][$x], $lumCap[$y-1][$x+1],
                            $lumCap[$y][$x+1], $lumCap[$y+1][$x+1], $lumCap[$y+1][$x],
                            $lumCap[$y+1][$x-1], $lumCap[$y][$x-1]
                        ];
                        $neighbors2 = [
                            $lumEnr[$y-1][$x-1], $lumEnr[$y-1][$x], $lumEnr[$y-1][$x+1],
                            $lumEnr[$y][$x+1], $lumEnr[$y+1][$x+1], $lumEnr[$y+1][$x],
                            $lumEnr[$y+1][$x-1], $lumEnr[$y][$x-1]
                        ];

                        $code1 = 0; $code2 = 0;
                        for ($i = 0; $i < 8; $i++) {
                            if ($neighbors1[$i] >= $c1) $code1 |= (1 << $i);
                            if ($neighbors2[$i] >= $c2) $code2 |= (1 << $i);
                        }

                        // Assign to 8 bins
                        $histCap[$code1 % 8]++;
                        $histEnr[$code2 % 8]++;
                    }
                }

                // Histogram intersection
                $sumCap = array_sum($histCap);
                $sumEnr = array_sum($histEnr);
                if ($sumCap > 0 && $sumEnr > 0) {
                    $intersection = 0.0;
                    for ($b = 0; $b < 8; $b++) {
                        $p1 = $histCap[$b] / (float) $sumCap;
                        $p2 = $histEnr[$b] / (float) $sumEnr;
                        $intersection += min($p1, $p2);
                    }
                    $totalLbpSimilarity += $intersection;
                }
            }
        }
        $lbpScore = ($totalLbpSimilarity / ($gridCells * $gridCells)) * 100.0;

        // 2. Spatial Gradient Correlation (Sobel Horiz & Vert structure)
        $gradCapList = [];
        $gradEnrList = [];
        for ($y = 1; $y < $size - 1; $y += 2) {
            for ($x = 1; $x < $size - 1; $x += 2) {
                $gx1 = $lumCap[$y][$x + 1] - $lumCap[$y][$x - 1];
                $gy1 = $lumCap[$y + 1][$x] - $lumCap[$y - 1][$x];
                $gradCapList[] = sqrt($gx1 * $gx1 + $gy1 * $gy1);

                $gx2 = $lumEnr[$y][$x + 1] - $lumEnr[$y][$x - 1];
                $gy2 = $lumEnr[$y + 1][$x] - $lumEnr[$y - 1][$x];
                $gradEnrList[] = sqrt($gx2 * $gx2 + $gy2 * $gy2);
            }
        }

        $gradCount = count($gradCapList);
        $gradScore = 0.0;
        if ($gradCount > 0) {
            $mean1 = array_sum($gradCapList) / $gradCount;
            $mean2 = array_sum($gradEnrList) / $gradCount;

            $num = 0.0; $den1 = 0.0; $den2 = 0.0;
            for ($i = 0; $i < $gradCount; $i++) {
                $d1 = $gradCapList[$i] - $mean1;
                $d2 = $gradEnrList[$i] - $mean2;
                $num += ($d1 * $d2);
                $den1 += ($d1 * $d1);
                $den2 += ($d2 * $d2);
            }

            $den = sqrt($den1 * $den2);
            if ($den > 0.0001) {
                $pearson = $num / $den; // -1 to +1
                $gradScore = max(0.0, $pearson) * 100.0;
            }
        }

        // 3. Chrominance Distribution Similarity (Skin & Tone consistency)
        $diffCb = 0.0; $diffCr = 0.0;
        $totalSampleCount = $size * $size;
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                $diffCb += abs($cbCap[$y][$x] - $cbEnr[$y][$x]);
                $diffCr += abs($crCap[$y][$x] - $crEnr[$y][$x]);
            }
        }
        $avgCbDiff = $diffCb / (float) $totalSampleCount;
        $avgCrDiff = $diffCr / (float) $totalSampleCount;
        $colorScore = max(0.0, 100.0 - (($avgCbDiff + $avgCrDiff) / 2.0 / 40.0 * 100.0));

        // Composite Facial Similarity Score (Weighted)
        // LBP (45%): captures facial structure & local texture invariant to lighting
        // Gradient (35%): captures eye, nose, mouth spatial edges
        // Color (20%): verifies skin and tone consistency
        $compositeSimilarity = ($lbpScore * 0.45) + ($gradScore * 0.35) + ($colorScore * 0.20);
        $compositeSimilarity = round(max(5.0, min(99.0, $compositeSimilarity)), 2);

        $threshold = 75.0;
        $matched = $compositeSimilarity >= $threshold;

        Log::info('Local face verification calculated', [
            'voter_id' => $voterId,
            'lbp_score' => round($lbpScore, 2),
            'grad_score' => round($gradScore, 2),
            'color_score' => round($colorScore, 2),
            'similarity' => $compositeSimilarity,
            'matched' => $matched,
            'threshold' => $threshold,
        ]);

        return [
            'matched' => $matched,
            'similarity' => $compositeSimilarity,
            'faceMatches' => [
                ['face_id' => "local_{$voterId}", 'similarity' => $compositeSimilarity]
            ],
            'mode' => 'local',
            'error_code' => $matched ? null : 'no_match',
            'error' => $matched ? null : "Face does not match registered voter (similarity: {$compositeSimilarity}%, required: {$threshold}%).",
        ];
    }

    /**
     * Remove a face from the collection.
     */
    public function removeFace(?string $faceId): bool
    {
        if (empty($faceId) || str_starts_with($faceId, 'local_')) {
            return true;
        }

        if (!$this->isAwsMode()) {
            return true;
        }

        try {
            $client = $this->getClient();
            $result = $client->deleteFaces([
                'CollectionId' => $this->collectionId,
                'FaceIds' => [$faceId],
            ]);

            $deletedCount = count($result['DeletedFaces'] ?? []);
            return $deletedCount > 0;
        } catch (AwsException $e) {
            if ($e->getAwsErrorCode() === 'ResourceNotFoundException') {
                return false;
            }
            Log::warning('Rekognition removeFace error', [
                'face_id' => $faceId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Remove all faces for a voter by their external image ID.
     */
    public function removeFacesByVoterId(int $voterId): int
    {
        if (!$this->isAwsMode()) {
            return 0;
        }

        $externalImageId = "voter_{$voterId}";

        try {
            $client = $this->getClient();
            $result = $client->listFaces([
                'CollectionId' => $this->collectionId,
                'MaxResults' => 100,
            ]);

            $faceIds = [];
            foreach ($result['Faces'] ?? [] as $face) {
                if (($face['ExternalImageId'] ?? '') === $externalImageId) {
                    $faceIds[] = $face['FaceId'];
                }
            }

            if (empty($faceIds)) {
                return 0;
            }

            $deleteResult = $client->deleteFaces([
                'CollectionId' => $this->collectionId,
                'FaceIds' => $faceIds,
            ]);

            return count($deleteResult['DeletedFaces'] ?? []);
        } catch (AwsException $e) {
            Log::warning('Rekognition removeFacesByVoterId error', [
                'voter_id' => $voterId,
                'error' => $e->getMessage(),
            ]);
            return 0;
        }
    }

    /**
     * Strip data-URI prefix from base64 string and decode to raw bytes.
     */
    public static function decodeImage(string $base64): string
    {
        if (str_contains($base64, ';base64,')) {
            $base64 = preg_replace('/^data:image\/\w+;base64,/', '', $base64);
        }

        $decoded = base64_decode($base64, true);

        if ($decoded === false) {
            throw new \InvalidArgumentException('Invalid base64 image data');
        }

        return $decoded;
    }

    /**
     * Validate that raw bytes look like a JPEG or PNG image.
     */
    public static function validateImageFormat(string $bytes): bool
    {
        $len = strlen($bytes);
        if ($len < 4) {
            return false;
        }

        // JPEG magic: FF D8 FF
        if (ord($bytes[0]) === 0xFF && ord($bytes[1]) === 0xD8 && ord($bytes[2]) === 0xFF) {
            return true;
        }

        // PNG magic: 89 50 4E 47
        if (ord($bytes[0]) === 0x89 && $bytes[1] === 'P' && $bytes[2] === 'N' && $bytes[3] === 'G') {
            return true;
        }

        return false;
    }

    public function getMatchThreshold(): float
    {
        return $this->matchThreshold;
    }

    public function getQualityThreshold(): float
    {
        return $this->qualityThreshold;
    }

    public function getCollectionId(): string
    {
        return $this->collectionId;
    }

    public function getActiveDriver(): string
    {
        return $this->isAwsMode() ? 'rekognition' : 'local';
    }
}
