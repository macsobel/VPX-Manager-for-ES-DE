import subprocess
from pathlib import Path
from PIL import Image
import logging
import os

logger = logging.getLogger(__name__)

def rotate_image(file_path: str, angle: int):
    """
    Rotate an image by the given angle (in degrees clockwise).
    Uses macOS 'sips' for robustness against malformed PNG headers.
    """
    try:
        abs_file_path = os.path.abspath(file_path)
        # sips uses degrees clockwise
        # Pillow was doing some weird mapping, but sips is direct.
        # angle is already clockwise from frontend.
        cmd = ["sips", "-r", str(angle), abs_file_path]
        logger.info(f"Manually rotating image {file_path} by {angle} degrees using sips")
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        logger.error(f"Error rotating image {file_path} with sips: {e}")
        # Fallback to Pillow if sips fails (e.g. if we were on Linux, but this app is Mac-focused)
        try:
            from PIL import Image
            with Image.open(file_path) as img:
                if angle == 90:
                    method = Image.ROTATE_270
                elif angle == 270 or angle == -90:
                    method = Image.ROTATE_90
                elif angle == 180:
                    method = Image.ROTATE_180
                else:
                    return
                rotated = img.transpose(method)
                rotated.save(file_path)
                logger.info(f"Rotation successful via Pillow fallback")
        except Exception as e2:
            logger.error(f"Pillow fallback also failed: {e2}")
            raise e2

def rotate_image_if_needed(file_path: str):
    """
    Legacy function. Rotation is now handled via manual UI controls or explicit scraper logic.
    """
    pass

def process_downloaded_image(file_path: str, source: str, key: str):
    """
    Apply user-specific rotation rules to downloaded media:
    1. VPinMediaDB "table.png" -> always rotate right 90 degrees.
    2. ScreenScraper "Table Screenshot" -> rotate right 90 degrees IF wider than height.
    """
    try:
        # Only process images
        ext = Path(file_path).suffix.lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp"):
            return

        if source == "vpinmediadb" and key in ("1k/table.png", "4k/table.png", "table.png"):
            logger.info(f"Applying VPinMediaDB table.png rotation rule to {file_path}")
            rotate_image(file_path, 90)
            return

        if source == "screenscraper" and key in ("ss", "sstitle"):
            from PIL import Image
            with Image.open(file_path) as img:
                width, height = img.size
            if width > height:
                logger.info(f"Applying ScreenScraper landscape screenshot rotation rule to {file_path}")
                rotate_image(file_path, 90)
    except Exception as e:
        logger.error(f"Error processing downloaded image {file_path}: {e}")

def normalize_video(file_path: str):
    """
    Ensure video is in a browser-compatible format (H.264 / yuv420p).
    Fixes the 'No supported format' error caused by yuv444p downloads.
    """
    try:
        # 1. Metadata check with ffprobe
        # Using full path discovered: /usr/local/bin/ffprobe
        # Wrap file_path in abspath to prevent command injection with filenames starting with '-'
        abs_file_path = os.path.abspath(file_path)
        cmd_meta = [
            "/usr/local/bin/ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,pix_fmt", "-of", "json", abs_file_path
        ]
        import json
        output = subprocess.check_output(cmd_meta).decode()
        data = json.loads(output)
        
        if not data.get("streams"):
            return
            
        stream = data["streams"][0]
        codec = stream.get("codec_name")
        pix_fmt = stream.get("pix_fmt")
        
        # We normalize if it's not yuv420p or not h264
        if pix_fmt != "yuv420p" or codec != "h264":
            logger.info(f"Normalizing video {file_path} (current: {codec}/{pix_fmt})")
            temp_path = file_path + ".norm.mp4"
            
            # 2. Transcode with ffmpeg
            # Using full path discovered: /usr/local/bin/ffmpeg
            abs_temp_path = os.path.abspath(temp_path)
            cmd_trans = [
                "/usr/local/bin/ffmpeg", "-y", "-i", abs_file_path,
                "-pix_fmt", "yuv420p",
                "-c:v", "libx264",
                "-crf", "23",
                "-preset", "fast",
                "-c:a", "copy", # Keep audio as is
                abs_temp_path
            ]
            subprocess.check_call(cmd_trans, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # 3. Swap files
            os.replace(abs_temp_path, abs_file_path)
            logger.info(f"Video normalized successfully: {file_path}")
            
    except Exception as e:
        logger.error(f"Error normalizing video {file_path}: {e}")
