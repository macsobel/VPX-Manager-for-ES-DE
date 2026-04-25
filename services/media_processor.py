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
        import imageio_ffmpeg
        import json
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        # 1. Metadata check with ffmpeg (ffprobe not bundled)
        abs_file_path = os.path.abspath(file_path)
        
        # We can extract codec info by using ffmpeg -i and parsing, but to get JSON-like structure
        # without ffprobe is tricky. Wait, we can just run a quick transcode check, or use regex.
        import re
        cmd_meta = [ffmpeg_exe, "-i", abs_file_path]
        out = subprocess.run(cmd_meta, capture_output=True, text=True)
        
        # Find Video stream info: Stream #0:0(eng): Video: h264 (Main) (avc1 / ...), yuv420p, 1920x1080
        video_stream_match = re.search(r"Stream #\d+:\d+.*?: Video: ([\w]+).*?,\s*([\w]+)[,\s]", out.stderr)
        
        if not video_stream_match:
            logger.warning(f"Could not parse video stream info for {file_path}")
            return
            
        codec = video_stream_match.group(1)
        pix_fmt = video_stream_match.group(2)
        
        # We normalize if it's not yuv420p or not h264
        if pix_fmt != "yuv420p" or codec != "h264":
            logger.info(f"Normalizing video {file_path} (current: {codec}/{pix_fmt})")
            temp_path = abs_file_path + ".norm.mp4"
            
            # 2. Transcode with bundled ffmpeg
            cmd_trans = [
                ffmpeg_exe, "-y", "-i", abs_file_path,
                "-pix_fmt", "yuv420p",
                "-c:v", "libx264",
                "-crf", "23",
                "-preset", "fast",
                "-c:a", "copy", # Keep audio as is
                temp_path
            ]
            subprocess.check_call(cmd_trans, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # 3. Swap files
            os.replace(temp_path, abs_file_path)
            logger.info(f"Video normalized successfully: {file_path}")
            
    except Exception as e:
        logger.error(f"Error normalizing video {file_path}: {e}")

def process_downloaded_video(file_path: str, source: str, key: str):
    """
    Lightweight video rotation using metadata injection.
    Does NOT re-encode the video (-c copy).
    Uses +faststart to ensure the moov atom is at the beginning, allowing browsers to stream it properly.
    """
    try:
        # Check user-specified rules for rotation
        needs_rotation = False
        if source == "vpinmediadb" and key in ("1k/video.mp4", "1k/table.mp4", "4k/table.mp4"):
            needs_rotation = True
        elif source == "screenscraper" and key == "videotable":
            needs_rotation = True

        if not needs_rotation:
            return

        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        logger.info(f"Applying lightweight 90-degree right metadata rotation to video {file_path}")
        abs_file_path = os.path.abspath(file_path)
        temp_path = abs_file_path + ".rot.mp4"
        cmd = [
            ffmpeg_exe, "-y", 
            "-display_rotation", "270", # 270 CCW = 90 CW (Right)
            "-i", abs_file_path,
            "-c", "copy",
            "-movflags", "+faststart",
            temp_path
        ]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(temp_path, abs_file_path)
        logger.info(f"Video metadata rotation successful: {file_path}")
    except Exception as e:
        logger.error(f"Error rotating video metadata {file_path}: {e}")

def rotate_video_metadata_manual(file_path: str, angle: int):
    """
    Manually rotate a video file using metadata injection by a specific angle.
    Note: ffmpeg -display_rotation uses COUNTER-CLOCKWISE degrees.
    The UI provides CLOCKWISE degrees (90, 180, 270).
    """
    try:
        import imageio_ffmpeg
        import re
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        abs_file_path = os.path.abspath(file_path)
        
        # Read current rotation using ffmpeg
        current_angle = 0
        cmd_meta = [ffmpeg_exe, "-i", abs_file_path]
        try:
            out = subprocess.run(cmd_meta, capture_output=True, text=True)
            match = re.search(r"displaymatrix:\s*rotation\s*of\s*([\-\d\.]+)\s*degrees", out.stderr)
            if match:
                current_angle = int(float(match.group(1)))
        except Exception as meta_e:
            logger.debug(f"Could not read current rotation metadata: {meta_e}")

        # Convert Clockwise input to Counter-Clockwise for ffmpeg
        # new_angle (CCW) = (current_angle (CCW) - clockwise_delta) % 360
        new_angle = (current_angle - angle) % 360

        temp_path = abs_file_path + ".rot.mp4"
        cmd = [
            ffmpeg_exe, "-y", 
            "-display_rotation", str(new_angle),
            "-i", abs_file_path,
            "-c", "copy",
            "-movflags", "+faststart",
            temp_path
        ]

        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(temp_path, abs_file_path)
        logger.info(f"Manual video metadata rotation to {new_angle} successful: {file_path}")
    except Exception as e:
        logger.error(f"Error manually rotating video {file_path}: {e}")
        raise
