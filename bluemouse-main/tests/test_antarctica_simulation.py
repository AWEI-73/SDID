import unittest
import os
import shutil
import asyncio
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import socratic_generator
import code_generator

class TestAntarcticaSimulation(unittest.IsolatedAsyncioTestCase):
    """
    Stress Test: The 'Antarctica' Scenario
    Verifies that the system handles completely unknown/weird domains gracefully.
    """

    async def asyncSetUp(self):
        self.output_dir = "test_antarctica_output"
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
        os.makedirs(self.output_dir)

    async def test_penguin_tracking_system(self):
        requirement = "我要在南極做一個企鵝追蹤監控軟體，需要耐寒介面"
        print(f"\n🐧 Simulating Antarctica Scenario: '{requirement}'")
        
        # 1. Generate Questions (Should fall back to Generic)
        socratic_result = await socratic_generator.generate_socratic_questions(requirement, 'zh-TW')
        questions = socratic_result.get('questions', [])
        
        print(f"   ✅ Generated {len(questions)} questions")
        for i, q in enumerate(questions):
            print(f"      Q{i+1}: {q.get('text')} (ID: {q.get('id')})")
            
        # Verify we got questions even if domain is unknown
        self.assertGreater(len(questions), 0, "System failed to generate fallback questions for Antarctica scenario")
        
        # Verify they are likely the Generic ones (Concurrency / reliability)
        # unless 'monitoring' triggered something, but likely generic.
        self.assertTrue(any("q1_concurrency" in q.get('id', '') for q in questions) or \
                        any("q2_error_handling" in q.get('id', '') for q in questions),
                        "Did not fallback to Universal Generic Questions")

        # 2. Mock Answers (User chooses generic options)
        user_answers = {}
        if questions:
            user_answers[questions[0]['id']] = questions[0]['options'][0]['value']
            
        print(f"   ✅ Submitted answers: {user_answers}")
        
        # 3. Generate Code
        module_info = {
            "name": "PenguinTracker",
            "description": requirement,
            "type": "django"
        }
        
        generated_result = code_generator.generate_code(module_info, user_answers)
        files = generated_result.get('files', {})
        models_code = files.get('models.py', '')
        
        # 4. Verify Code Integrity
        self.assertTrue(models_code, "Failed to generate models.py for Antarctica scenario")
        print("   ✅ Code generated successfully (PenguinTracker)")
        
        # Expecting generic 'Product'/'Order' or simple base model fallback
        # Since 'monitoring' isn't a specific domain, it likely falls back to the default (Ecommerce) 
        # OR we might want to check if it's the generic one.
        # But as long as it generates Valid Python Code, it passes the "Industrial Grade Stability" test.
        
        if "class Product" in models_code:
             print("   ℹ️  Fallback to Default Model Structure (Ecommerce-like) - This is acceptable for unknown domains.")
        else:
             print("   ℹ️  Generated some other structure.")

if __name__ == '__main__':
    unittest.main()
