"""
電商後台 - 商品管理功能
根據 leaf_product_management 節點規格實作
"""
from datetime import datetime
import uuid

def create_product(
    product_name: str,
    price: float,
    stock: int,
    category: str,
    description: str = ""
) -> dict:
    """
    創建新商品
    
    Args:
        product_name: 商品名稱 (必填)
        price: 商品價格 (必填，必須 >= 0)
        stock: 庫存數量 (必填，必須 >= 0)
        category: 商品分類 (必填)
        description: 商品描述 (選填)
    
    Returns:
        dict: 包含 product_id, created_at, success
    
    Side Effects:
        - DatabaseWrite: 寫入資料庫
        - LogOperation: 記錄操作日誌
    
    Complexity: O(1)
    """
    # 驗證必填欄位
    if not product_name:
        raise ValueError("Product name is required")
    if not category:
        raise ValueError("Category is required")
    
    # 驗證價格
    if price < 0:
        raise ValueError("Price must be >= 0")
    
    # 驗證庫存
    if stock < 0:
        raise ValueError("Stock must be >= 0")
    
    # 生成商品 ID
    product_id = f"PROD_{uuid.uuid4().hex[:8].upper()}"
    
    # 獲取當前時間
    created_at = datetime.now().isoformat()
    
    # TODO: 實際的資料庫寫入邏輯
    # db.products.insert({
    #     "id": product_id,
    #     "name": product_name,
    #     "price": price,
    #     "stock": stock,
    #     "category": category,
    #     "description": description,
    #     "created_at": created_at
    # })
    
    # 記錄操作日誌
    log_operation("create_product", {
        "product_id": product_id,
        "product_name": product_name,
        "price": price
    })
    
    return {
        "product_id": product_id,
        "created_at": created_at,
        "success": True
    }


def log_operation(action: str, details: dict):
    """記錄操作日誌 (符合 LogOperation side effect)"""
    # TODO: 實際的日誌記錄邏輯
    print(f"[OPERATION LOG] {action}: {details}")


# 使用範例
if __name__ == "__main__":
    # 測試創建商品
    result = create_product(
        product_name="iPhone 15 Pro",
        price=35900,
        stock=100,
        category="3C電子",
        description="最新款 iPhone，256GB 鈦藍色"
    )
    print(f"✅ 商品創建成功: {result}")
