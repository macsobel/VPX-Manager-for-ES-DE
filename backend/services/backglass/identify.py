import sys
import time
import platform
import ctypes
import ctypes.util
import subprocess

def hide_dock_icon_macos():
    """Hide the app icon from the macOS Dock at runtime."""
    if platform.system() != "Darwin":
        return
    try:
        # Load AppKit
        appkit_path = ctypes.util.find_library('AppKit')
        if not appkit_path: return
        appkit = ctypes.cdll.LoadLibrary(appkit_path)
        
        # Get NSApp
        ns_app = appkit.NSApplication.sharedApplication()
        
        # NSApplicationActivationPolicyProhibited = 2 (No Dock, No Menu)
        appkit.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long]
        appkit.objc_msgSend.restype = ctypes.c_void_p
        
        set_policy_sel = appkit.sel_registerName(b"setActivationPolicy:")
        appkit.objc_msgSend(ns_app, set_policy_sel, 2)
    except Exception:
        pass

def identify_screen_cocoa(display_index):
    """Native macOS Cocoa identification window."""
    try:
        from AppKit import (
            NSApplication, NSWindow, NSView, NSScreen,
            NSBorderlessWindowMask, NSBackingStoreBuffered,
            NSApplicationActivationPolicyProhibited,
            NSColor, NSBezierPath, NSTextField, NSFont,
            NSCenterTextAlignment, NSApp
        )
        from Foundation import NSMakeRect, NSTimer, NSRunLoop, NSDefaultRunLoopMode
    except ImportError:
        return # Fallback not implemented for identify

    hide_dock_icon_macos()

    app = NSApplication.sharedApplication()
    app.setActivationPolicy_(NSApplicationActivationPolicyProhibited)

    screens = NSScreen.screens()
    if display_index >= len(screens):
        display_index = 0
    
    target_screen = screens[display_index]
    frame = target_screen.frame()
    screen_w = int(frame.size.width)
    screen_h = int(frame.size.height)
    
    win_size = int(min(screen_h * 0.7, screen_w * 0.7, 800))
    win_size = max(win_size, 300)
    
    # Center on screen
    wx = frame.origin.x + (screen_w - win_size) // 2
    wy = frame.origin.y + (screen_h - win_size) // 2
    win_frame = NSMakeRect(wx, wy, win_size, win_size)

    window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_screen_(
        win_frame,
        NSBorderlessWindowMask,
        NSBackingStoreBuffered,
        False,
        target_screen
    )
    window.setLevel_(100) # Always on top
    window.setBackgroundColor_(NSColor.colorWithCalibratedRed_green_blue_alpha_(10/255, 12/255, 20/255, 1.0))

    # Main Digit View
    class DigitView(NSView):
        def drawRect_(self, rect):
            # Border
            border_t = max(8, win_size // 40)
            NSColor.colorWithCalibratedRed_green_blue_alpha_(79/255, 140/255, 255/255, 1.0).set()
            path = NSBezierPath.bezierPathWithRect_(NSMakeRect(0, 0, win_size, win_size))
            path.setLineWidth_(border_t)
            path.stroke()
            
            # Scanlines
            NSColor.colorWithCalibratedRed_green_blue_alpha_(15/255, 18/255, 30/255, 1.0).set()
            step = max(2, win_size // 150)
            for i in range(0, win_size, step):
                p = NSBezierPath.bezierPath()
                p.moveToPoint_((0, i))
                p.lineToPoint_((win_size, i))
                p.setLineWidth_(1)
                p.stroke()

    view = DigitView.alloc().initWithFrame_(NSMakeRect(0, 0, win_size, win_size))
    window.setContentView_(view)

    # Big Number Label
    label = NSTextField.alloc().initWithFrame_(NSMakeRect(0, win_size//2 - win_size//4, win_size, win_size//2))
    label.setStringValue_(str(display_index))
    label.setFont_(NSFont.boldSystemFontOfSize_(win_size//2))
    label.setTextColor_(NSColor.whiteColor())
    label.setDrawsBackground_(False)
    label.setBordered_(False)
    label.setAlignment_(NSCenterTextAlignment)
    label.setEditable_(False)
    view.addSubview_(label)

    # Footer Label
    footer_w = win_size // 4
    footer_h = win_size // 12
    footer_bg = NSView.alloc().initWithFrame_(NSMakeRect((win_size - footer_w)//2, win_size // 10, footer_w, footer_h))
    footer_bg.setWantsLayer_(True)
    footer_bg.layer().setBackgroundColor_(NSColor.colorWithCalibratedRed_green_blue_alpha_(79/255, 140/255, 255/255, 1.0).CGColor())
    view.addSubview_(footer_bg)

    footer_label = NSTextField.alloc().initWithFrame_(NSMakeRect(0, 0, footer_w, footer_h))
    footer_label.setStringValue_(str(display_index))
    footer_label.setFont_(NSFont.boldSystemFontOfSize_(footer_h * 0.8))
    footer_label.setTextColor_(NSColor.whiteColor())
    footer_label.setDrawsBackground_(False)
    footer_label.setBordered_(False)
    footer_label.setAlignment_(NSCenterTextAlignment)
    footer_label.setEditable_(False)
    footer_bg.addSubview_(footer_label)

    window.makeKeyAndOrderFront_(None)
    window.orderFrontRegardless()

    # Close after 5 seconds
    def close_app():
        NSApp.terminate_(None)

    class Closer:
        @staticmethod
        def fire_(timer):
            close_app()

    timer = NSTimer.timerWithTimeInterval_target_selector_userInfo_repeats_(
        5.0, Closer, 'fire:', None, False
    )
    NSRunLoop.currentRunLoop().addTimer_forMode_(timer, NSDefaultRunLoopMode)

    app.run()

if __name__ == "__main__":
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if platform.system() == "Darwin":
        identify_screen_cocoa(idx)
    else:
        # Linux fallback could go here
        pass
