
import sys
import os
import json

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import mmla_validate_code_logic, load_spec

# Define a Spec File for testing
SPEC_FILE = "mmla_spec.json"
TEST_NODE_ID = "stripe_payment_node"

def setup_authorized_parasite():
    """
    Setup a scenario where the 'Parasite' (Node) is explicitly granted
    permission to access the 'External API' (Host Resource).
    """
    if os.path.exists(SPEC_FILE):
        with open(SPEC_FILE, 'r') as f:
            data = json.load(f)
    else:
        data = {"id": "root", "modules": []}

    # 1. Defined the Node (The Parasite)
    test_node = {
        "id": TEST_NODE_ID,
        "name": "process_payment",
        "type": "LEAF",
        "status": "GREEN",
        "spec": {
            "inputs": [{"name": "token", "type": "str"}, {"name": "amount", "type": "int"}],
            "outputs": {"type": "dict"}
        }
        # Note: No strict dependencies here, they come from parent
    }
    
    # 2. Define the Host Environment (Parent Module)
    # This represents the "Host" granting the "Parasite" access to specific tools.
    parent_module = {
        "id": "external_gateway",
        "name": "External Gateway",
        "type": "MODULE",
        "dependencies": ["requests", "json"], # 🚨 KEY: Granting Permission!
        "children": [test_node]
    }
    
    # Update Spec
    if "modules" not in data:
        data["modules"] = []
    
    # Clean up old
    data["modules"] = [m for m in data["modules"] if m["id"] != "external_gateway"]
    data["modules"].append(parent_module)
    
    with open(SPEC_FILE, 'w') as f:
        json.dump(data, f)
    print(f"✅ Setup: Host 'External Gateway' configured. Parasite granted access to: ['requests', 'json']")

def test_authorized_api_access():
    print("\n🔗 Testing Authorized API Parasitism...")
    
    # The code attempts to 'parasitize' the requests library to send data out.
    parasitic_code = """
import requests
import json

def process_payment(token: str, amount: int) -> dict:
    \"\"\"Call Stripe API to process payment.\"\"\"
    url = "https://api.stripe.com/v1/charges"
    payload = {"amount": amount, "currency": "usd", "source": token}
    
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status()
        return response.json()
    except Exception as error_msg:  # Fix: 'e' is too short
        return {"error": str(error_msg)}
    """
    
    # Verify using the 4-Layer Defense Grid
    result_json = mmla_validate_code_logic(parasitic_code, TEST_NODE_ID)
    result = json.loads(result_json)
    
    if result["success"]:
        print("✅ SUCCESS: API Parasitism Successful.")
        print("   - Layer 1 (Syntax): PASS")
        print("   - Layer 2 (Signature): PASS")
        print("   - Layer 3 (Dependency): PASS (Host Authorized 'requests')")
        print("   - Layer 4 (Logic): PASS")
    else:
        print(f"❌ FAILED: The Parasite was rejected. Errors: {result['errors']}")

def test_unauthorized_expansion_attempt():
    print("\n🛡️ Testing Unauthorized Expansion (The 'Virus' Test)...")
    
    # RESET SPEC: Remove ALL permissions to simulate strict lockdown
    if os.path.exists(SPEC_FILE):
        with open(SPEC_FILE, 'r') as f:
            data = json.load(f)
            
        # Find our parent module and STRIP permissions
        for m in data.get("modules", []):
            if m["id"] == "external_gateway":
                m["dependencies"] = [] # 🚨 REMOVE PERMISSIONS!
        
        with open(SPEC_FILE, 'w') as f:
            json.dump(data, f)
    print("   ℹ️  Permissions revoked. Host is now verified secure.")
    
    # The code attempts to access a library system NOT granted by the host (e.g., 'os')
    malicious_code = """
import requests
import os # 🚨 UNAUTHORIZED ACCESS ATTEMPT

def process_payment(token: str, amount: int) -> dict:
    \"\"\"Try to steal secrets.\"\"\"
    # Variable names must be long enough
    api_key_val = os.environ.get("API_KEY") # This should be blocked
    return {"stolen": api_key_val}
    """
    
    result_json = mmla_validate_code_logic(malicious_code, TEST_NODE_ID)
    result = json.loads(result_json)
    
    if not result["success"]:
        # We expect failure due to Dependnecy Check
        errors = str(result["errors"])
        if "Undeclared dependencies" in errors:
            print("✅ SUCCESS: Unauthorized expansion BLOCKED.")
            print(f"   - Defense Log: {result['errors'][0]}")
        else:
             print(f"⚠️ BLOCKED, but for wrong reason: {errors}")
    else:
        print(f"❌ FAILED: Malicious expansion was allowed! Result: {result}")

if __name__ == "__main__":
    print("🧬 Verifying API Parasitism Capabilities 🧬")
    setup_authorized_parasite()
    test_authorized_api_access()
    test_unauthorized_expansion_attempt()
    print("\n🏁 API Parasitism Verification Complete.")
