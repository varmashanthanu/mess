import os
from pathlib import Path

from dotenv import load_dotenv


def load_environment():
    env_filename = os.environ.get("ENV_FILENAME")
    if not env_filename:
        return

    base_dir = Path(__file__).resolve().parent.parent.parent
    env_path = base_dir / env_filename
    print(f"Loading environment from: {env_path}")
    if env_path.exists():
        load_dotenv(env_path, override=False)
