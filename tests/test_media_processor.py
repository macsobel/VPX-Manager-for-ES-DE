import pytest
import os
import subprocess
from unittest.mock import patch, MagicMock
from backend.services.media_processor import normalize_video

@patch("services.media_processor.subprocess.check_call")
@patch("services.media_processor.subprocess.run")
@patch("services.media_processor.os.replace")
def test_normalize_video_command_injection(mock_replace, mock_subprocess_run, mock_check_call):
    # Mock ffmpeg -i output to trigger ffmpeg transcode call
    mock_subprocess_run.return_value = MagicMock(stderr="Stream #0:0(eng): Video: h264 (Main), yuv444p, 1920x1080")

    malicious_filename = "-test.mp4"
    normalize_video(malicious_filename)

    # Assert ffmpeg -i subprocess.run is secure
    assert mock_subprocess_run.called
    cmd_meta = mock_subprocess_run.call_args[0][0]

    # Verify the last argument (file_path) is an absolute path, not starting with '-'
    assert cmd_meta[-1] == os.path.abspath(malicious_filename)
    assert not cmd_meta[-1].startswith("-")

    # Assert ffmpeg check_call is secure
    assert mock_check_call.called
    cmd_trans = mock_check_call.call_args[0][0]

    # Verify the input and output arguments are absolute paths
    input_index = cmd_trans.index("-i") + 1
    assert cmd_trans[input_index] == os.path.abspath(malicious_filename)
    assert not cmd_trans[input_index].startswith("-")

    output_arg = cmd_trans[-1]
    assert output_arg == os.path.abspath(malicious_filename + ".norm.mp4")
    assert not output_arg.startswith("-")
