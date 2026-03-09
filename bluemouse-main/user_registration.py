"""
使用者註冊功能
根據 leaf_user_registration 節點規格實作
"""
import re
import uuid
import hashlib

def register_user(
    email: str,
    password: str,
    username: str,
    phone: str = None
) -> dict:
    """
    註冊新使用者
    
    Args:
        email: 使用者 email (必填，需符合 email 格式)
        password: 密碼 (必填，至少 8 字元)
        username: 使用者名稱 (必填，3-20 字元)
        phone: 手機號碼 (選填)
    
    Returns:
        dict: 包含 user_id, success, message
    
    Side Effects:
        - DatabaseWrite: 寫入使用者資料
        - SendEmail: 發送驗證信
    
    Complexity: O(1)
    """
    # 驗證 email 格式
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return {
            "user_id": "",
            "success": False,
            "message": "Invalid email format"
        }
    
    # 驗證密碼長度
    if len(password) < 8:
        return {
            "user_id": "",
            "success": False,
            "message": "Password must be at least 8 characters"
        }
    
    # 驗證使用者名稱長度
    if len(username) < 3 or len(username) > 20:
        return {
            "user_id": "",
            "success": False,
            "message": "Username must be between 3 and 20 characters"
        }
    
    # TODO: 檢查 email 是否已存在
    # if db.users.find_one({"email": email}):
    #     return {"user_id": "", "success": False, "message": "Email already exists"}
    
    # 生成使用者 ID
    user_id = f"USER_{uuid.uuid4().hex[:12].upper()}"
    
    # 密碼加密 (使用 SHA-256，實際應使用 bcrypt)
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # TODO: 寫入資料庫
    # db.users.insert({
    #     "id": user_id,
    #     "email": email,
    #     "password_hash": password_hash,
    #     "username": username,
    #     "phone": phone,
    #     "created_at": datetime.now().isoformat(),
    #     "verified": False
    # })
    
    # 發送驗證信
    send_verification_email(email, user_id)
    
    return {
        "user_id": user_id,
        "success": True,
        "message": "Registration successful. Please check your email for verification."
    }


def send_verification_email(email: str, user_id: str):
    """發送驗證信 (符合 SendEmail side effect)"""
    # TODO: 實際的 email 發送邏輯
    verification_link = f"https://example.com/verify?user_id={user_id}"
    print(f"[EMAIL] Sending verification to {email}: {verification_link}")


# 使用範例
if __name__ == "__main__":
    result = register_user(
        email="test@example.com",
        password="SecurePass123",
        username="testuser",
        phone="+886912345678"
    )
    print(f"註冊結果: {result}")
