import sys
from pathlib import Path

# Add physics_engine/ root to path so tests can import solver and tracker
sys.path.insert(0, str(Path(__file__).parent))