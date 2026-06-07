import subprocess
import logging
import shutil
import time

logger = logging.getLogger(__name__)


def wait_for_pid_window(
    pid: int,
    timeout: float = 15.0,
    poll_interval: float = 0.5,
) -> bool:
    """
    Block until a visible window owned by `pid` appears in the window manager,
    or until `timeout` seconds have elapsed.

    This is necessary for cold-start launches where the process exists (pgrep
    finds it) but the window has not been mapped yet by X11/the WM. Without
    this wait, wmctrl and xdotool find zero windows for the PID and every
    focus attempt silently fails.

    Args:
        pid: Process ID to wait for.
        timeout: Maximum seconds to wait before giving up.
        poll_interval: How often (in seconds) to re-check.

    Returns:
        True if a window for the PID was found before the timeout.
    """
    wmctrl_cmd = shutil.which("wmctrl")
    xdotool_cmd = shutil.which("xdotool")
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        # Strategy 1: wmctrl -l -p
        if wmctrl_cmd:
            try:
                result = subprocess.run(
                    [wmctrl_cmd, "-l", "-p"],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                for line in result.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 3:
                        try:
                            if int(parts[2]) == pid:
                                logger.debug(
                                    f"wait_for_pid_window: window found for PID {pid} via wmctrl"
                                )
                                return True
                        except ValueError:
                            continue
            except Exception:
                pass

        # Strategy 2: xdotool search --pid
        if xdotool_cmd:
            try:
                result = subprocess.run(
                    [xdotool_cmd, "search", "--onlyvisible", "--pid", str(pid)],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
                if result.stdout.strip():
                    logger.debug(
                        f"wait_for_pid_window: window found for PID {pid} via xdotool"
                    )
                    return True
            except Exception:
                pass

        time.sleep(poll_interval)

    logger.warning(
        f"wait_for_pid_window: no window appeared for PID {pid} within {timeout}s"
    )
    return False


def focus_window_by_pid(pid: int, retries: int = 3, retry_delay: float = 0.75) -> bool:
    """
    Focus the window belonging to a specific PID.

    This is the most reliable method on Linux because it is completely immune to
    window title or process name changes across application updates. It uses the
    process ID that the caller already knows about.

    Strategies tried in order:
      1. wmctrl -l -p  → find window ID for PID → wmctrl -i -a <wid>
      2. xdotool search --pid <pid> → windowactivate --sync + windowfocus --sync

    Args:
        pid: The process ID of the target application.
        retries: Number of total attempts before giving up.
        retry_delay: Seconds to wait between retry attempts.

    Returns:
        True if focus was successfully restored, False otherwise.
    """
    wmctrl_cmd = shutil.which("wmctrl")
    xdotool_cmd = shutil.which("xdotool")

    for attempt in range(retries):
        if attempt > 0:
            time.sleep(retry_delay)

        # ── Strategy 1: wmctrl -l -p → -i -a ─────────────────────────────
        # List all windows with PIDs, find the one matching our PID, then
        # activate by window ID (not name — completely name-independent).
        if wmctrl_cmd:
            try:
                result = subprocess.run(
                    [wmctrl_cmd, "-l", "-p"],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                if result.returncode == 0:
                    for line in result.stdout.splitlines():
                        parts = line.split()
                        # Format: <wid> <desktop> <pid> <host> <title...>
                        if len(parts) >= 3:
                            try:
                                window_pid = int(parts[2])
                            except ValueError:
                                continue
                            if window_pid == pid:
                                wid = parts[0]
                                res = subprocess.run(
                                    [wmctrl_cmd, "-i", "-a", wid],
                                    check=False,
                                    stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL,
                                )
                                if res.returncode == 0:
                                    logger.info(
                                        f"Used wmctrl -i -a to focus PID {pid} "
                                        f"(wid={wid}, attempt {attempt + 1})"
                                    )
                                    return True
            except Exception as e:
                logger.debug(f"wmctrl PID focus failed: {e}")

        # ── Strategy 2: xdotool search --pid ─────────────────────────────
        if xdotool_cmd:
            try:
                result = subprocess.run(
                    [xdotool_cmd, "search", "--onlyvisible", "--pid", str(pid)],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                wids = result.stdout.strip().split()
                if wids:
                    wid = wids[0]
                    subprocess.run(
                        [xdotool_cmd, "windowactivate", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    subprocess.run(
                        [xdotool_cmd, "windowfocus", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    logger.info(
                        f"Used xdotool search --pid to focus PID {pid} "
                        f"(wid={wid}, attempt {attempt + 1})"
                    )
                    return True
            except Exception as e:
                logger.debug(f"xdotool PID focus failed: {e}")

    logger.warning(
        f"Failed to focus PID {pid} after {retries} attempt(s) "
        f"(wmctrl={'found' if wmctrl_cmd else 'not found'}, "
        f"xdotool={'found' if xdotool_cmd else 'not found'})."
    )
    return False


def focus_window(window_name: str, retries: int = 3, retry_delay: float = 0.5) -> bool:
    """
    Attempts to bring a window to the front on Linux by title/class name.

    Use this only when the target PID is not known. Prefer focus_window_by_pid()
    when the PID is available, as it is immune to window-title changes.

    Strategies tried in order per attempt:
      1. wmctrl -a  (substring match on window title)
      2. wmctrl -x -a  (WM_CLASS match — works even with version-suffixed titles)
      3. xdotool search --onlyvisible --name  (regex title match)
      4. xdotool search --onlyvisible --classname  (WM class match)

    Args:
        window_name: A substring of the target window's title or WM class name.
        retries: How many total attempts to make before giving up.
        retry_delay: Seconds to wait between retry attempts.

    Returns:
        True if focus was successfully restored, False otherwise.
    """
    wmctrl_cmd = shutil.which("wmctrl")
    xdotool_cmd = shutil.which("xdotool")

    for attempt in range(retries):
        if attempt > 0:
            time.sleep(retry_delay)

        # ── Strategy 1: wmctrl -a (substring title match) ─────────────────
        if wmctrl_cmd:
            try:
                res = subprocess.run(
                    [wmctrl_cmd, "-a", window_name],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                if res.returncode == 0:
                    logger.info(f"Used wmctrl -a to focus '{window_name}' (attempt {attempt + 1})")
                    return True
            except Exception as e:
                logger.debug(f"wmctrl -a focus failed: {e}")

            # ── Strategy 2: wmctrl -x (WM_CLASS match) ────────────────────
            try:
                res = subprocess.run(
                    [wmctrl_cmd, "-x", "-a", window_name],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                if res.returncode == 0:
                    logger.info(f"Used wmctrl -x -a to focus '{window_name}' (attempt {attempt + 1})")
                    return True
            except Exception as e:
                logger.debug(f"wmctrl -x -a focus failed: {e}")

        # ── Strategy 3: xdotool search --name (regex title match) ─────────
        if xdotool_cmd:
            try:
                result = subprocess.run(
                    [xdotool_cmd, "search", "--onlyvisible", "--name", window_name],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                wids = result.stdout.strip().split()
                if wids:
                    wid = wids[0]
                    subprocess.run(
                        [xdotool_cmd, "windowactivate", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    subprocess.run(
                        [xdotool_cmd, "windowfocus", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    logger.info(
                        f"Used xdotool search --name to focus '{window_name}' "
                        f"(wid={wid}, attempt {attempt + 1})"
                    )
                    return True
            except Exception as e:
                logger.debug(f"xdotool search --name focus failed: {e}")

            # ── Strategy 4: xdotool search --classname ─────────────────────
            try:
                result = subprocess.run(
                    [xdotool_cmd, "search", "--onlyvisible", "--classname", window_name],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                wids = result.stdout.strip().split()
                if wids:
                    wid = wids[0]
                    subprocess.run(
                        [xdotool_cmd, "windowactivate", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    subprocess.run(
                        [xdotool_cmd, "windowfocus", "--sync", wid],
                        check=False,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    logger.info(
                        f"Used xdotool search --classname to focus '{window_name}' "
                        f"(wid={wid}, attempt {attempt + 1})"
                    )
                    return True
            except Exception as e:
                logger.debug(f"xdotool search --classname focus failed: {e}")

    logger.warning(
        f"Failed to focus '{window_name}' after {retries} attempt(s) "
        f"(wmctrl={'found' if wmctrl_cmd else 'not found'}, "
        f"xdotool={'found' if xdotool_cmd else 'not found'})."
    )
    return False


def focus_esde(
    pid: int | None = None,
    delay: float = 1.5,
    retries: int = 3,
    retry_delay: float = 0.75,
    window_wait_timeout: float = 15.0,
) -> bool:
    """
    Restore keyboard focus to ES-DE on Linux.

    When the ES-DE PID is known, uses PID-based focusing (the most reliable
    approach, immune to window title changes across ES-DE updates). Falls back
    to name-based strategies using all known ES-DE window title / WM class
    variants if the PID approach fails or no PID is provided.

    On a cold-start launch ES-DE's process exists before its window is mapped.
    This function waits up to `window_wait_timeout` seconds for the window to
    actually appear before attempting to activate it, which prevents all focus
    attempts from silently failing on slow-loading / freshly-launched ES-DE.

    Args:
        pid: The ES-DE process ID (preferred). Pass None to skip PID-based focus.
        delay: Seconds to wait before the first attempt (allows triggering
               windows like the backglass companion to finish opening/closing).
        retries: Passed through to the underlying focus functions.
        retry_delay: Passed through to the underlying focus functions.
        window_wait_timeout: Maximum seconds to wait for ES-DE's window to be
               mapped before attempting focus. Covers slow/cold-start launches.
               Set to 0 to disable the wait (e.g. when ES-DE is already fully
               running and its window is guaranteed to be visible).

    Returns:
        True if focus was successfully restored, False otherwise.
    """
    time.sleep(delay)

    # ── Wait for ES-DE's window to be mapped (cold-start guard) ───────────
    # When ES-DE is freshly launched it can take several seconds for its window
    # to appear. We poll the WM until the window is visible so that the focus
    # attempt below has something to activate. If the window is already up
    # (e.g. returning focus after VPX closes) this returns almost instantly.
    if pid is not None and window_wait_timeout > 0:
        if not wait_for_pid_window(pid, timeout=window_wait_timeout):
            # Window never appeared — fall through to name-based focus which
            # has its own retry loop and may still succeed.
            logger.debug(
                f"focus_esde: ES-DE window (PID {pid}) never appeared within "
                f"{window_wait_timeout}s, trying name-based focus."
            )

    # ── Primary: PID-based focus (name-change-proof) ───────────────────────
    if pid is not None:
        if focus_window_by_pid(pid, retries=retries, retry_delay=retry_delay):
            return True
        logger.debug(f"PID-based focus failed for ES-DE PID {pid}, falling back to name search.")

    # ── Fallback: name/class-based focus ──────────────────────────────────
    # "es-de" is the stable WM_CLASS registered by ES-DE regardless of version.
    # "ES-DE" matches the window title (may include version string — wmctrl does
    # substring matching so "ES-DE" still hits "ES-DE 3.1.0").
    # "EmulationStation" is kept for older builds.
    for name in ["es-de", "ES-DE", "EmulationStation"]:
        if focus_window(name, retries=retries, retry_delay=retry_delay):
            return True

    logger.warning("focus_esde: All focus strategies (PID + name variants) failed.")
    return False
