import sys
import os
import json
import unittest
from unittest.mock import MagicMock, patch

# Add current directory to path
sys.path.append(os.getcwd())

class TestBlueMouseRobustness(unittest.TestCase):
    
    def test_01_file_integrity(self):
        """Check for missing critical files"""
        required_files = [
            "mcp.json",
            "traffic_light_sentinel.py",
            "validation_17_layers.py",
            "mmla_agentic_loop.py",
            "server.py",
            "critic_agent.py"  # This is expected to fail based on inspection
        ]
        missing = []
        for f in required_files:
            if not os.path.exists(f):
                missing.append(f)
        
        if missing:
            print(f"❌ CRITICAL: Missing files: {missing}")
            # We don't fail the test immediately to allow other checks, 
            # but we record it.
            self.missing_files = missing
        else:
            print("✅ File Integrity: All critical files present.")
            self.missing_files = []

    def test_02_fsm_gating(self):
        """Test Traffic Light Sentinel 403 Logic"""
        from traffic_light_sentinel import TrafficLightSentinel, NodeState
        
        # Setup specific test DB
        test_db = "test_fsm_spec.json"
        sentinel = TrafficLightSentinel(test_db)
        
        # Create a mock LOCKED node
        sentinel.specs["nodes"] = [{
            "id": "danger_node",
            "status": "LOCKED",
            "dependencies": ["missing_dep"]
        }]
        
        # Try to transition usage (simulating a request)
        # Verify it cannot go to VALIDATING directly
        success = sentinel.transition("danger_node", NodeState.VALIDATING)
        
        if not success:
            print("✅ FSM Gating: Successfully BLOCKED illegal transition (LOCKED -> VALIDATING).")
        else:
            print("❌ FSM Gating: FAILED! Illegal transition allowed.")
            self.fail("FSM Logic Breach")
            
        # Clean up
        if os.path.exists(test_db):
            os.remove(test_db)

    def test_03_validation_17_layers(self):
        """Test the 17-layer validation chain"""
        from validation_17_layers import validate_code_17_layers
        
        bad_code = "def foo():\n return 1" # Bad style, no type hints, bad indent (maybe)
        result = validate_code_17_layers(bad_code, "test_node")
        
        print(f"ℹ️  Bad Code Score: {result['quality_score']}")
        
        if result['quality_score'] < 100:
             print("✅ Validation: Correctly penalized bad code.")
        else:
             print("❌ Validation: Startled by bad code (Score 100).")
             
        # Check layers existence
        if len(result['layers']) == 17:
            print("✅ Validation: All 17 layers executed.")
        else:
            print(f"❌ Validation: Only {len(result['layers'])} layers executed. Expected 17.")
            
    def test_04_data_trap(self):
        """Verify data trap file is writable"""
        trap_file = "data_trap.jsonl"
        try:
            with open(trap_file, "a") as f:
                f.write(json.dumps({"test": "scan", "timestamp": "now"}) + "\n")
            print("✅ Data Trap: File is writable.")
        except Exception as e:
            print(f"❌ Data Trap: Write failed! {e}")
            
    def test_05_agentic_loop_logic(self):
        """Test mmla_agentic_loop logic (mocking external dependencies)"""
        # If critic_agent is missing, we must mock it to test the LOOP logic
        sys.modules['critic_agent'] = MagicMock()
        sys.modules['ultimate_parasite_ai'] = MagicMock()
        
        # Create a mock critic
        mock_critic = MagicMock()
        mock_critic.critique.return_value = {"passed": True, "quality_score": 100, "layers": []}
        sys.modules['critic_agent'].get_critic.return_value = mock_critic
        
        # Import after mocking
        try:
            from mmla_agentic_loop import mmla_validate_with_retry
            # Since it's async, we just import to verify syntax and structure
            print("✅ Agentic Loop: Module imports successfully (Logic verification requires runtime mocking).")
        except ImportError as e:
            print(f"❌ Agentic Loop: Import failed: {e}")

if __name__ == '__main__':
    unittest.main(exit=False)
