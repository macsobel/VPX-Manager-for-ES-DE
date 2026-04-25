import pytest
import os
import subprocess
from unittest.mock import patch, MagicMock
from services.media_processor import normalize_video

@patch("services.media_processor.subprocess.check_call")
@patch("services.media_processor.subprocess.check_output")
@patch("services.media_processor.os.replace")
def test_normalize_video_command_injection(mock_replace, mock_check_output, mock_check_call):
    # Mock ffprobe output to trigger ffmpeg call
    mock_check_output.return_value = b'{"streams": [{"codec_name": "h264", "pix_fmt": "yuv444p"}]}'

    malicious_filename = "-test.mp4"
    normalize_video(malicious_filename)

    # Assert ffprobe check_output is secure
    assert mock_check_output.called
    cmd_meta = mock_check_output.call_args[0][0]

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
