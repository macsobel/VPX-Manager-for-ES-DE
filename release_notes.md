### Changes
- **Fixed ES-DE Integration Bug**: Resolved a critical issue where the "Enable Custom Event Scripts" and "Browsing Custom Events" settings were not being correctly toggled in `es_settings.xml`.
- **Robust Settings Updates**: Replaced the standard XML parser with a line-based string manipulation logic for `es_settings.xml`. This ensures reliable updates even for files that lack a standard XML root element, which was causing the previous parser to fail silently.
- **Improved Reliability**: The "Apply Integration" tool in the Tools page now correctly enables the necessary ES-DE features to support the Backglass Companion and automated launcher scripts.
