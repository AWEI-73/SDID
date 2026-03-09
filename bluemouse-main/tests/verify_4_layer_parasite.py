
import sys
import os
import json

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import mmla_validate_code_logic, load_spec

# Create a mock node in spec for testing if not exists
SPEC_FILE = "mmla_spec.json"
TEST_NODE_ID = "test_node_parasite"

def setup_test_node():
    if os.path.exists(SPEC_FILE):
        with open(SPEC_FILE, 'r') as f:
            data = json.load(f)
    else:
        data = {"id": "root", "modules": []}

    # Add test node
    test_node = {
        "id": TEST_NODE_ID,
        "name": "calculate_tax",
        "type": "LEAF",
        "status": "GREEN",
        "spec": {
            "inputs": [{"name": "amount", "type": "float"}, {"name": "rate", "type": "float"}],
            "outputs": {"type": "float"}
        }
        # Dependencies must be defined on PARENT to be valid allowed list
    }
    
    if "modules" not in data:
        data["modules"] = []
    
    # Clean up old node
    data["modules"] = [m for m in data["modules"] if m["id"] != TEST_NODE_ID]

    # Create a parent module to hold the dependencies
    parent_module = {
        "id": "tax_module",
        "name": "Tax Module",
        "type": "MODULE",
        "dependencies": ["math"], # Grant permission here!
        "children": [test_node]
    }
    
    # Remove old parent if exists
    data["modules"] = [m for m in data["modules"] if m["id"] != "tax_module"]
    data["modules"].append(parent_module)
    
    with open(SPEC_FILE, 'w') as f:
        json.dump(data, f)
    print(f"✅ Setup: Parent 'tax_module' created with allowed dependencies: ['math']")

def test_layer_1_syntax():
    print("\n🧐 Testing Layer 1: Syntax & Type Filter (AST)")
    bad_code = """
def calculate_tax(amount, rate)
    return amount * rate # Missing colon
    """
    result = json.loads(mmla_validate_code_logic(bad_code, TEST_NODE_ID))
    if result["syntax_check"] == "FAIL":
        print(f"✅ Layer 1 Blocked Syntax Error: {result['errors'][0]}")
    else:
        print("❌ Layer 1 FAILED to block syntax error")

def test_layer_2_signature():
    print("\n🧐 Testing Layer 2: Schema/Signature Validator")
    # Wrong function name
    bad_code = """
def wrong_name(amount, rate):
    return amount * rate
    """
    result = json.loads(mmla_validate_code_logic(bad_code, TEST_NODE_ID))
    if any("Function signature mismatch" in e for e in result["errors"]):
        print(f"✅ Layer 2 Blocked Wrong Function Name: {result['errors'][0]}")
    else:
        print("❌ Layer 2 FAILED to block wrong function name")

def test_layer_3_dependency():
    print("\n🧐 Testing Layer 3: Dependency Check (The Parasitic Filter)")
    # Illegal import
    bad_code = """
import requests # Not allowed!
import subprocess # Definitely not allowed!

def calculate_tax(amount, rate):
    return amount * rate
    """
    result = json.loads(mmla_validate_code_logic(bad_code, TEST_NODE_ID))
    if result["dependency_check"] == "FAIL":
        print(f"✅ Layer 3 Blocked Illegal Imports: {result['errors'][0]}")
    else:
        print(f"❌ Layer 3 FAILED to block illegal imports. Result: {result}")

def test_success_case():
    print("\n✨ Testing Valid Code (Should Pass)")
    good_code = """
import math

def calculate_tax(amount: float, rate: float) -> float:
    \"\"\"Calculate tax based on rate.\"\"\"
    return amount * rate
    """
    result = json.loads(mmla_validate_code_logic(good_code, TEST_NODE_ID))
    if result["success"]:
        print("✅ Valid code passed all 4 layers.")
    else:
        print(f"❌ Valid code failed validation: {result['errors']}")

if __name__ == "__main__":
    print("🛡️ Commencing 4-Layer Parasitic Defense Verification 🛡️")
    setup_test_node()
    test_layer_1_syntax()
    test_layer_2_signature()
    test_layer_3_dependency()
    test_success_case()
    print("\n🏁 Verification Complete.")
