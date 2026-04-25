import subprocess
from pathlib import Path
from PIL import Image
import logging
import os

logger = logging.getLogger(__name__)

def rotate_image(file_path: str, angle: int):
    """
    Rotate an image by the given angle (in degrees clockwise).
    PIL.Image.ROTATE_90 is 90 deg counter-clockwise.
    PIL.Image.ROTATE_270 is 270 deg counter-clockwise (90 deg clockwise).
    """
    try:
        with Image.open(file_path) as img:
            # PIL constants:
            # ROTATE_90 = 90 deg CCW
            # ROTATE_180 = 180 deg
            # ROTATE_270 = 90 deg CW
            if angle == 90:
                method = Image.ROTATE_270
            elif angle == 270 or angle == -90:
                method = Image.ROTATE_90
            elif angle == 180:
                method = Image.ROTATE_180
            else:
                logger.warning(f"Unsupported rotation angle: {angle}")
                return

            logger.info(f"Manually rotating image {file_path} by {angle} degrees")
            rotated = img.transpose(method)
            rotated.save(file_path)
    except Exception as e:
        logger.error(f"Error rotating image {file_path}: {e}")
        raise e

def rotate_image_if_needed(file_path: str):
    """
    Legacy function. Rotation is now handled via manual UI controls or explicit scraper logic.
    """
    pass

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
