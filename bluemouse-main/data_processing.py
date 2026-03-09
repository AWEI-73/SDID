"""
Data Processing Functions - 純 Python 實作
不依賴外部庫,適合訓練和驗證
"""

import json
import csv
import statistics
from typing import List, Dict, Any, Optional, Tuple


def load_dataset(
    filepath: str,
    format: str = "csv"
) -> List[Dict[str, Any]]:
    """
    載入多種格式數據 (CSV, JSON)
    
    Args:
        filepath: 檔案路徑
        format: 數據格式 ('csv', 'json')
    
    Returns:
        List[Dict]: 數據列表,每行是一個字典
    
    Raises:
        ValueError: 不支援的格式
        FileNotFoundError: 檔案不存在
    
    Examples:
        >>> data = load_dataset("data.csv", format="csv")
        >>> data = load_dataset("data.json", format="json")
    """
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            if format == "csv":
                reader = csv.DictReader(f)
                return list(reader)
            elif format == "json":
                return json.load(f)
            else:
                raise ValueError(f"不支援的格式: {format}. 支援: csv, json")
    except FileNotFoundError:
        raise FileNotFoundError(f"檔案不存在: {filepath}")


def clean_missing_values(
    data: List[Dict[str, Any]],
    strategy: str = "drop",
    columns: Optional[List[str]] = None,
    fill_value: Any = None
) -> List[Dict[str, Any]]:
    """
    處理缺失值 (Drop, Fill, Mean)
    
    Args:
        data: 輸入數據列表
        strategy: 處理策略 ('drop', 'fill', 'mean')
        columns: 要處理的欄位列表 (None = 全部)
        fill_value: strategy='fill' 時使用的填充值
    
    Returns:
        List[Dict]: 處理後的數據
    
    Raises:
        ValueError: 無效的策略
    
    Examples:
        >>> clean_data = clean_missing_values(data, strategy="drop")
        >>> clean_data = clean_missing_values(data, strategy="fill", fill_value=0)
    """
    if not data:
        return []
    
    # 確定要處理的欄位
    target_cols = columns if columns else list(data[0].keys())
    
    if strategy == "drop":
        # 刪除包含缺失值的行
        result = []
        for row in data:
            has_missing = False
            for col in target_cols:
                value = row.get(col)
                if value is None or value == "" or value == "None":
                    has_missing = True
                    break
            if not has_missing:
                result.append(row.copy())
        return result
    
    elif strategy == "fill":
        # 使用指定值填充
        if fill_value is None:
            raise ValueError("strategy='fill' 需要提供 fill_value 參數")
        result = []
        for row in data:
            new_row = row.copy()
            for col in target_cols:
                if new_row.get(col) is None or new_row.get(col) == "":
                    new_row[col] = fill_value
            result.append(new_row)
        return result
    
    elif strategy == "mean":
        # 使用平均值填充 (僅數值欄位)
        result = []
        
        # 計算每個欄位的平均值
        means = {}
        for col in target_cols:
            values = []
            for row in data:
                val = row.get(col)
                if val is not None and val != "":
                    try:
                        values.append(float(val))
                    except (ValueError, TypeError):
                        pass
            if values:
                means[col] = statistics.mean(values)
        
        # 填充缺失值
        for row in data:
            new_row = row.copy()
            for col in target_cols:
                if (new_row.get(col) is None or new_row.get(col) == "") and col in means:
                    new_row[col] = means[col]
            result.append(new_row)
        return result
    
    else:
        raise ValueError(f"無效的策略: {strategy}. 支援: drop, fill, mean")


def detect_outliers(
    data: List[Dict[str, Any]],
    column: str,
    method: str = "zscore",
    threshold: float = 3.0
) -> List[Dict[str, Any]]:
    """
    離群值偵測 (Z-Score, IQR)
    
    Args:
        data: 輸入數據列表
        column: 要檢測的欄位
        method: 檢測方法 ('zscore', 'iqr')
        threshold: 閾值 (zscore: 通常 3.0, iqr: 通常 1.5)
    
    Returns:
        List[Dict]: 包含 'is_outlier' 欄位的數據
    
    Raises:
        ValueError: 無效的方法或欄位不存在
    
    Examples:
        >>> data_with_outliers = detect_outliers(data, "age", method="zscore")
        >>> outliers = [row for row in data_with_outliers if row["is_outlier"]]
    """
    if not data:
        return []
    
    # 提取數值
    values = []
    for row in data:
        val = row.get(column)
        if val is not None:
            try:
                values.append(float(val))
            except (ValueError, TypeError):
                raise ValueError(f"欄位 {column} 包含非數值資料")
    
    if not values:
        raise ValueError(f"欄位 {column} 沒有有效數值")
    
    result = []
    
    if method == "zscore":
        # Z-Score 方法
        mean = statistics.mean(values)
        try:
            stdev = statistics.stdev(values)
        except statistics.StatisticsError:
            # 標準差為 0,沒有離群值
            for row in data:
                new_row = row.copy()
                new_row["is_outlier"] = False
                result.append(new_row)
            return result
        
        for row in data:
            new_row = row.copy()
            val = row.get(column)
            if val is not None:
                try:
                    z_score = abs((float(val) - mean) / stdev)
                    new_row["is_outlier"] = z_score > threshold
                except (ValueError, TypeError):
                    new_row["is_outlier"] = False
            else:
                new_row["is_outlier"] = False
            result.append(new_row)
    
    elif method == "iqr":
        # IQR (四分位距) 方法
        sorted_values = sorted(values)
        n = len(sorted_values)
        
        Q1 = sorted_values[n // 4]
        Q3 = sorted_values[(3 * n) // 4]
        IQR = Q3 - Q1
        
        lower_bound = Q1 - threshold * IQR
        upper_bound = Q3 + threshold * IQR
        
        for row in data:
            new_row = row.copy()
            val = row.get(column)
            if val is not None:
                try:
                    float_val = float(val)
                    new_row["is_outlier"] = (float_val < lower_bound) or (float_val > upper_bound)
                except (ValueError, TypeError):
                    new_row["is_outlier"] = False
            else:
                new_row["is_outlier"] = False
            result.append(new_row)
    
    else:
        raise ValueError(f"無效的方法: {method}. 支援: zscore, iqr")
    
    return result


def split_train_test(
    data: List[Dict[str, Any]],
    test_size: float = 0.2,
    random_seed: Optional[int] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    切分訓練集與測試集
    
    Args:
        data: 輸入數據列表
        test_size: 測試集比例 (0.0 - 1.0)
        random_seed: 隨機種子
    
    Returns:
        dict: {"train": 訓練集, "test": 測試集}
    
    Raises:
        ValueError: 無效的參數
    
    Examples:
        >>> split_data = split_train_test(data, test_size=0.2, random_seed=42)
        >>> train_data = split_data["train"]
        >>> test_data = split_data["test"]
    """
    import random
    
    if not 0 < test_size < 1:
        raise ValueError(f"test_size 必須在 0 和 1 之間,當前: {test_size}")
    
    if not data:
        return {"train": [], "test": []}
    
    # 設定隨機種子
    if random_seed is not None:
        random.seed(random_seed)
    
    # 複製並打亂數據
    shuffled_data = data.copy()
    random.shuffle(shuffled_data)
    
    # 計算切分點
    test_count = int(len(shuffled_data) * test_size)
    
    # 切分
    test_data = shuffled_data[:test_count]
    train_data = shuffled_data[test_count:]
    
    return {
        "train": train_data,
        "test": test_data
    }


def calculate_statistics(
    data: List[Dict[str, Any]],
    column: str
) -> Dict[str, float]:
    """
    計算欄位的統計資訊
    
    Args:
        data: 輸入數據列表
        column: 要計算的欄位
    
    Returns:
        dict: {"mean": 平均值, "median": 中位數, "std": 標準差, "min": 最小值, "max": 最大值}
    
    Raises:
        ValueError: 欄位不存在或非數值
    
    Examples:
        >>> stats = calculate_statistics(data, "age")
        >>> print(f"平均年齡: {stats['mean']}")
    """
    # 提取數值
    values = []
    for row in data:
        val = row.get(column)
        if val is not None:
            try:
                values.append(float(val))
            except (ValueError, TypeError):
                pass
    
    if not values:
        raise ValueError(f"欄位 {column} 沒有有效數值")
    
    return {
        "mean": statistics.mean(values),
        "median": statistics.median(values),
        "std": statistics.stdev(values) if len(values) > 1 else 0.0,
        "min": min(values),
        "max": max(values),
        "count": len(values)
    }


# 測試代碼
if __name__ == "__main__":
    # 建立測試數據
    test_data = [
        {"age": "25", "income": "50000", "category": "A"},
        {"age": "30", "income": "60000", "category": "B"},
        {"age": "35", "income": "70000", "category": "A"},
        {"age": None, "income": "80000", "category": "B"},  # 缺失值
        {"age": "45", "income": "90000", "category": "A"},
        {"age": "200", "income": "100000", "category": "B"},  # 離群值
    ]
    
    print("=" * 60)
    print("🧪 測試 5 個真實函數")
    print("=" * 60)
    
    # 測試 1: 處理缺失值
    print("\n✅ 測試 1: clean_missing_values (strategy='mean')")
    clean_data = clean_missing_values(test_data, strategy="mean", columns=["age"])
    print(f"原始數據行數: {len(test_data)}")
    print(f"處理後行數: {len(clean_data)}")
    print(f"第 4 行 age (原本是 None): {clean_data[3]['age']}")
    
    # 測試 2: 離群值檢測
    print("\n✅ 測試 2: detect_outliers (method='zscore')")
    outlier_data = detect_outliers(clean_data, "age", method="zscore", threshold=2.0)
    outliers = [row for row in outlier_data if row.get("is_outlier")]
    print(f"檢測到 {len(outliers)} 個離群值")
    for row in outliers:
        print(f"  - age={row['age']} 是離群值")
    
    # 測試 3: 切分訓練測試集
    print("\n✅ 測試 3: split_train_test (test_size=0.3)")
    split_data = split_train_test(clean_data, test_size=0.3, random_seed=42)
    print(f"訓練集大小: {len(split_data['train'])}")
    print(f"測試集大小: {len(split_data['test'])}")
    
    # 測試 4: 計算統計資訊
    print("\n✅ 測試 4: calculate_statistics (column='age')")
    stats = calculate_statistics(clean_data, "age")
    print(f"平均值: {stats['mean']:.2f}")
    print(f"中位數: {stats['median']:.2f}")
    print(f"標準差: {stats['std']:.2f}")
    print(f"最小值: {stats['min']:.2f}")
    print(f"最大值: {stats['max']:.2f}")
    
    # 測試 5: Drop 策略
    print("\n✅ 測試 5: clean_missing_values (strategy='drop')")
    dropped_data = clean_missing_values(test_data, strategy="drop")
    print(f"原始數據行數: {len(test_data)}")
    print(f"刪除缺失值後: {len(dropped_data)}")
    
    print("\n" + "=" * 60)
    print("🎉 所有測試完成!")
    print("=" * 60)
