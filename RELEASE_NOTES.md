This is the first complete version of VPX Manager for ES-DE that fully supports Linux.

### Linux Improvements:
* **ES-DE Backglass Companion**: Fully supported on Linux. It automatically locates the ES-DE directory (preferring modern `~/ES-DE` with fallback to `~/.emulationstation`).
* **Dynamic Media Directory**: The correct `esde_media_dir` path is now parsed from configuration and routed dynamically to the backglass companion, ensuring backglass images display correctly for each selected table.
* **Window Focus Restoration**: Implemented robust PID-based window focusing on Linux. Focus is correctly returned to EmulationStation when launching the backglass companion, as well as when closing Visual Pinball Standalone.
* **Architecture Support**: AppImages are built and available for both Linux `x86_64` and `ARM64` processors.

### macOS Support:
* **Unchanged Behavior**: All existing features, including backglass display and window focusing, continue to work perfectly on macOS (DMGs available for both Intel and Apple Silicon).
