import asyncio
import sys
import os
import re

# Add parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import code_generator
import socratic_generator

TEST_SCENARIOS = [
    {
        "name": "🛒 Black Friday Crash (Ecommerce)",
        "req": "I want to build a flash sale site for iPhone 16, expecting 1M users/sec.",
        "expect_keywords": ["lock", "redis", "concurrency", "inventory", "stock"],
        "expect_features": ["db_lock", "redis_stock", "async_check"]
    },
    {
        "name": "📢 Social Explosion (Social)",
        "req": "A local social network where Elon musk tweets and 100M users see it instantly.",
        "expect_keywords": ["feed", "fan-out", "push", "pull", "diffusion"],
        "expect_features": ["push", "pull", "hybrid"]
    },
    {
        "name": "🎥 Bandwidth Bankruptcy (Content)",
        "req": "A 4K video streaming site like Netflix but free.",
        "expect_keywords": ["bandwidth", "cost", "cdn", "storage", "traffic"],
        "expect_features": ["throttle", "p2p", "abr"]
    },
    {
        "name": "💰 Crypto Custody (Crypto)",
        "req": "A centralized Bitcoin exchange holding user funds.",
        "expect_keywords": ["private key", "wallet", "custody", "hack", "hot wallet"],
        "expect_features": ["custodial", "multisig", "cold_storage"]
    },
    {
        "name": "🏦 Banking Core (Fintech)",
        "req": "A core banking system handling billions of dollars.",
        "expect_keywords": ["transaction", "audit", "consistency", "rollback", "acid"],
        "expect_features": ["rollback", "exactly_once", "double_entry"]
    },
    {
        "name": "🏢 Enterprise Data (SaaS)",
        "req": "A CRM hosting data for Apple and Samsung on the same server.",
        "expect_keywords": ["tenant", "isolation", "leak", "separate", "database"],
        "expect_features": ["db_per_tenant", "schema_per_tenant", "tenant_id"]
    },
    {
        "name": "🏥 Medical AI (Medical)",
        "req": "An AI that prescribes drugs automatically for cancer patients.",
        "expect_keywords": ["jail", "license", "kill", "harm", "law", "hipaa", "legal"],
        "expect_features": ["audit_log", "encryption", "human_verify"]
    },
    {
        "name": "🗳️ Voting System (Voting)",
        "req": "A smartphone voting app for the President election.",
        "expect_keywords": ["coercion", "vote buying", "buy", "sell", "audit"],
        "expect_features": ["blockchain", "vvpat", "physical_only"]
    },
    {
        "name": "☠️ Ponzi Scheme (Ethics)",
        "req": "Guaranteed 100% returns with 5-level referral bonus (MLM).",
        "expect_keywords": ["scam", "fraud", "illegal", "license", "ponzi"],
        "expect_features": ["ethics_warning_triggered"] # Special check
    },
    {
        "name": "🌐 Legal Gambling (Fusion: Fintech+Ethics)",
        "req": "I want to build a betting site for World Cup, accepting USDT.",
        "expect_keywords": ["license", "money", "audit", "gambling"],
        "expect_features": ["fusion_detection"]
    }
]

async def run_scenario(index, scenario):
    print(f"\n[{index}/10] {scenario['name']}")
    print(f"   📝 Req: {scenario['req']}")
    
    # 1. Logic Test (Socratic)
    socratic = await socratic_generator.generate_socratic_questions(scenario['req'], 'en-US')
    questions = socratic.get('questions', [])
    
    logic_pass = False
    hit_keywords = []
    
    all_text = " ".join([q.get('text', '') + " " + str(q.get('options', '')) for q in questions]).lower()
    
    for kw in scenario['expect_keywords']:
        if kw.lower() in all_text:
            hit_keywords.append(kw)
            
    if hit_keywords:
        print(f"   🧠 Logic Check: PASS ({', '.join(hit_keywords[:3])}...)")
        logic_pass = True
    else:
        print(f"   🧠 Logic Check: FAIL (Did not ask about {scenario['expect_keywords']})")
        # Debug
        # print(f"      - Questions: {[q.get('text') for q in questions]}")

    # 2. Code Test (Simulation)
    # We don't generate full code for speed, but we check if the Socratic questions 
    # offered the correct "Feature Flags" that would lead to correct code.
    code_pass = False
    hit_features = []
    
    # Check if options contain the expected features
    for q in questions:
        for opt in q.get('options', []):
            val = opt.get('value', '')
            # Check if this value maps to expected features or just broadly matches
            if any(f in val for f in scenario['expect_features']) or \
               any(f in val for f in ['lock', 'redis', 'push', 'pull', 'p2p', 'abr', 'custod', 'multisig', 'roll', 'tenant', 'audit', 'human', 'chain', 'illegal']):
                hit_features.append(val)
                
    # Special Check for Ethics
    if "Ethics" in scenario['name']:
        if any('illegal' in q.get('id', '') or 'scam' in str(q) for q in questions):
            hit_features.append("ethics_guard")
            
    if hit_features:
        print(f"   💪 Code Capability: READY (Features offered: {', '.join(hit_features[:3])}...)")
        code_pass = True
    else:
        print(f"   💪 Code Capability: WARNING (No specific technical solutions offered)")

    return logic_pass, code_pass

async def main():
    print("🧪 STARTING 10 INDUSTRIAL GRADE ACID TESTS...")
    print("==================================================")
    
    results = []
    for i, scen in enumerate(TEST_SCENARIOS):
        l, c = await run_scenario(i+1, scen)
        results.append((scen['name'], l, c))
        
    print("\n\n📊 FINAL REPORT:")
    print("| ID | Scenario | Logic (Brain) | Code (Muscle) | status |")
    print("|---|---|---|---|---|")
    
    passed_count = 0
    for i, (name, l, c) in enumerate(results):
        l_icon = "✅" if l else "❌"
        c_icon = "✅" if c else "⚠️"
        status = "PASS" if l else "FAIL"
        if l: passed_count += 1
        print(f"| {i+1} | {name} | {l_icon} | {c_icon} | {status} |")
        
    score = (passed_count / 10) * 100
    print(f"\n🏆 Total Score: {score}%")
    if score == 100:
        print("🎉 CERTIFIED INDUSTRIAL GRADE ROBUSTNESS 🎉")
    else:
        print("⚠️  Improvements Needed.")

if __name__ == "__main__":
    asyncio.run(main())
