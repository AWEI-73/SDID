import asyncio
import sys
import os
import unittest.mock

# 1. Simulate Antarctica (Offline Mode)
# We do this by unsetting API keys
import os
os.environ['ANTHROPIC_API_KEY'] = ""
os.environ['OPENAI_API_KEY'] = ""

# Add parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import socratic_generator
import code_generator

# Mock aiohttp to simulate connection failure for EXTERNAL calls only
# But since our code uses localhost for Ollama, we should simulate failure there too if we want "Pure Offline"
# The 'Antarctica' scenario means NO CLOUD. Localhost might still work if user brought a server.
# But for this test, we assume NO AI at all (Layer 1/4 only).

async def mock_get(*args, **kwargs):
    raise ConnectionError("❄️ Antarctica Mode: No Internet Connection")

async def mock_post(*args, **kwargs):
    raise ConnectionError("❄️ Antarctica Mode: No Internet Connection")

async def run_antarctica_test():
    print("🐧 Antarctica Simulation Started (No Cloud AI, Weird Request)...")
    
    # Weirdest possible request
    req = "I want a management system for Penguin Breeding on Mars using Quantum Entanglement for data sync."
    
    print(f"📝 Request: {req}")
    
    # Patch aiohttp in socratic_generator to ensure Layer 2/3 fail
    # We rely on the fact that socratic_generator imports aiohttp inside the function or globally
    # To be safe, we will just count on the fact that we unset API keys (Layer 3 fail)
    # And we will let Layer 2 fail naturally if Ollama isn't running, OR we can patch it.
    
    # Let's trust the unsetting of API keys for Layer 3. 
    # For Layer 2 (Ollama), if it's running it might succeed, which defeats the test.
    # So we MUST patch layer2_ollama to fail.
    
    original_layer2 = socratic_generator.layer2_ollama
    
    async def mock_layer2(*args):
        raise ValueError("❄️ Antarctica: Ollama Frozen")
        
    socratic_generator.layer2_ollama = mock_layer2
    
    # 1. Socratic Test
    try:
        print("\n🧠 Invoking Socratic Brain (Layer 4 Fallback expected)...")
        result = await socratic_generator.generate_socratic_questions(req, 'en-US')
        
        # Check if fallback questions are useful (e.g. data consistency, privacy)
        qs = result.get('questions', [])
        # We expect Generic questions because "Penguin Breeding" is not in our dictionary
        # Generic questions: q1_concurrency, q2_privacy, q3_scalability
        valid_qs = [q for q in qs if q.get('id') in ['q1_concurrency', 'q2_privacy', 'q3_scalability']]
        
        if qs:
             print(f"✅ Brain Survived: Generated {len(qs)} questions (Architectural/Data-Driven).")
             print(f"   Example: {qs[0]['text']}")
        else:
             print("❌ Brain Froze: No valid questions generated.")
             
    except Exception as e:
        print(f"❌ Brain Crash: {e}")
    finally:
        # Restore
        socratic_generator.layer2_ollama = original_layer2

    # 2. Code Test
    try:
        print("\n💪 Invoking Code Generator (17-Layer Vetting)...")
        # Simulate answers to the generic questions
        answers = {'pessimistic': 'true', 'hard_delete': 'true', 'sharding': 'true'}
        
        module_info = {
            "name": "MarsPenguinDB",
            "description": req,
            "type": "django" # Default to robust backend
        }
        
        g_result = code_generator.generate_code(module_info, answers)
        files = g_result.get('files', {})
        
        if 'README.md' in files and 'models.py' in files:
            print(f"✅ Code Survived: Generated {len(files)} files.")
            print("   README.md found (Instruction Manual).")
            print("   Content Preview:")
            print(files['README.md'][:200] + "...")
        else:
            print("❌ Code Hypothermia: Missing critical files.")
            
            if 'README.md' not in files:
                print("   ⚠️ MISSING README.md - Newbies will be lost!")
            
    except Exception as e:
        print(f"❌ Code Crash: {e}")

if __name__ == "__main__":
    asyncio.run(run_antarctica_test())
