import marshal
import os
import sys

def _get_key(key_name: str) -> str:
    """Get security key from environment or local ignored secrets file."""
    key = os.environ.get(key_name)
    if not key:
        try:
            import vpx_secrets
            key = getattr(vpx_secrets, key_name, None)
        except ImportError:
            pass
    if not key:
        raise RuntimeError(f"Security key {key_name} is missing. Must be set via environment variable or vpx_secrets.py")
    return key

def _scramble_gen(v: str) -> str:
    """XOR-based scrambling with the general key."""
    key = _get_key("VPX_GENERAL_KEY")
    return "".join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(v))

def _scramble_dev(v: str) -> str:
    """XOR-based scrambling with the dev key."""
    key = _get_key("VPX_DEV_KEY")
    return "".join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(v))

def generate_config_dat(dev_id, dev_password, dev_user, dev_pass, output_path="config.dat"):
    """
    Converts ScreenScraper credentials into a double-scrambled binary format.
    """
    def double_scramble(v):
        if not v: return ""
        return _scramble_dev(_scramble_gen(v))

    data = {
        "screenscraper_devid": double_scramble(dev_id),
        "screenscraper_devpassword": double_scramble(dev_password),
        "screenscraper_dev_user": double_scramble(dev_user),
        "screenscraper_dev_pass": double_scramble(dev_pass)
    }
    
    import json
    with open(output_path, "w") as f:
        json.dump(data, f)
    
    print(f"Successfully generated scrambled JSON {output_path} (ID len: {len(dev_id)})")

if __name__ == "__main__":
    # If environment variables are present (e.g. in GitHub Actions), use them
    # Otherwise, this script can be called with literal values for initial setup
    
    dev_id = os.environ.get("SS_DEV_ID")
    dev_password = os.environ.get("SS_DEVPASS")
    dev_user = os.environ.get("SS_USER") or ""
    dev_pass = os.environ.get("SS_PASS") or ""
    
    if not all([dev_id, dev_password]):
        if len(sys.argv) < 3:
            print("Error: SS_DEV_ID and SS_DEVPASS are required.")
            print("Usage: python build_utils.py <dev_id> <dev_pass> [dev_user] [dev_pass_val]")
            sys.exit(1)
        else:
            dev_id, dev_password = sys.argv[1:3]
            if len(sys.argv) >= 5:
                dev_user, dev_pass = sys.argv[3:5]
            
    generate_config_dat(dev_id, dev_password, dev_user, dev_pass)
