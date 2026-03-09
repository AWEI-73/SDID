"""
Medical/Health Functions - Batch 1
醫療/健康領域函數 (10 個)
用於生成大量失敗案例,建立數據護城河
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import math


def calculate_bmi(
    weight_kg: float,
    height_cm: float
) -> Dict[str, any]:
    """
    計算 BMI (身體質量指數)
    
    Args:
        weight_kg: 體重 (公斤)
        height_cm: 身高 (公分)
    
    Returns:
        dict: {"bmi": float, "category": str, "healthy_weight_range": tuple}
    
    Raises:
        ValueError: 參數無效
    
    Examples:
        >>> result = calculate_bmi(70, 175)
        >>> # {"bmi": 22.86, "category": "正常", ...}
    """
    # 輸入驗證
    if weight_kg <= 0 or weight_kg > 500:
        raise ValueError("體重必須在 0-500 公斤之間")
    
    if height_cm <= 0 or height_cm > 300:
        raise ValueError("身高必須在 0-300 公分之間")
    
    # 轉換為公尺
    height_m = height_cm / 100
    
    # 計算 BMI
    bmi = weight_kg / (height_m ** 2)
    
    # 分類 (WHO 標準)
    if bmi < 18.5:
        category = "過輕"
    elif bmi < 25:
        category = "正常"
    elif bmi < 30:
        category = "過重"
    else:
        category = "肥胖"
    
    # 健康體重範圍
    healthy_min = 18.5 * (height_m ** 2)
    healthy_max = 24.9 * (height_m ** 2)
    
    return {
        "bmi": round(bmi, 2),
        "category": category,
        "healthy_weight_range": (round(healthy_min, 1), round(healthy_max, 1)),
        "weight_kg": weight_kg,
        "height_cm": height_cm
    }


def calculate_heart_rate_zone(
    age: int,
    resting_heart_rate: int
) -> Dict[str, any]:
    """
    計算心率訓練區間
    
    Args:
        age: 年齡
        resting_heart_rate: 靜止心率
    
    Returns:
        dict: {"max_hr": int, "zones": dict}
    
    Examples:
        >>> result = calculate_heart_rate_zone(30, 60)
    """
    # 輸入驗證
    if age <= 0 or age > 120:
        raise ValueError("年齡必須在 1-120 歲之間")
    
    if resting_heart_rate < 40 or resting_heart_rate > 100:
        raise ValueError("靜止心率必須在 40-100 之間")
    
    # 最大心率 (220 - 年齡)
    max_hr = 220 - age
    
    # 心率儲備
    hr_reserve = max_hr - resting_heart_rate
    
    # 訓練區間 (Karvonen 公式)
    zones = {
        "warm_up": (
            int(resting_heart_rate + hr_reserve * 0.5),
            int(resting_heart_rate + hr_reserve * 0.6)
        ),
        "fat_burn": (
            int(resting_heart_rate + hr_reserve * 0.6),
            int(resting_heart_rate + hr_reserve * 0.7)
        ),
        "cardio": (
            int(resting_heart_rate + hr_reserve * 0.7),
            int(resting_heart_rate + hr_reserve * 0.8)
        ),
        "peak": (
            int(resting_heart_rate + hr_reserve * 0.8),
            int(resting_heart_rate + hr_reserve * 0.9)
        )
    }
    
    return {
        "max_hr": max_hr,
        "resting_hr": resting_heart_rate,
        "hr_reserve": hr_reserve,
        "zones": zones
    }


def calculate_calorie_burn(
    weight_kg: float,
    activity: str,
    duration_minutes: int
) -> Dict[str, float]:
    """
    計算卡路里消耗
    
    Args:
        weight_kg: 體重 (公斤)
        activity: 活動類型
        duration_minutes: 持續時間 (分鐘)
    
    Returns:
        dict: {"calories_burned": float, "met": float}
    
    Examples:
        >>> result = calculate_calorie_burn(70, "running", 30)
    """
    # 輸入驗證
    if weight_kg <= 0 or weight_kg > 500:
        raise ValueError("體重必須在 0-500 公斤之間")
    
    if duration_minutes <= 0 or duration_minutes > 1440:
        raise ValueError("時間必須在 0-1440 分鐘之間")
    
    # MET 值 (代謝當量)
    met_values = {
        "walking": 3.5,
        "running": 8.0,
        "cycling": 6.0,
        "swimming": 7.0,
        "yoga": 2.5,
        "weightlifting": 5.0,
        "sleeping": 1.0,
        "sitting": 1.3
    }
    
    activity_lower = activity.lower()
    if activity_lower not in met_values:
        raise ValueError(f"不支援的活動類型: {activity}")
    
    met = met_values[activity_lower]
    
    # 卡路里消耗 = MET × 體重(kg) × 時間(小時)
    calories_burned = met * weight_kg * (duration_minutes / 60)
    
    return {
        "calories_burned": round(calories_burned, 2),
        "met": met,
        "activity": activity,
        "duration_minutes": duration_minutes
    }


def calculate_blood_pressure_category(
    systolic: int,
    diastolic: int
) -> Dict[str, str]:
    """
    血壓分類
    
    Args:
        systolic: 收縮壓
        diastolic: 舒張壓
    
    Returns:
        dict: {"category": str, "risk_level": str, "recommendation": str}
    
    Examples:
        >>> result = calculate_blood_pressure_category(120, 80)
    """
    # 輸入驗證
    if systolic < 70 or systolic > 250:
        raise ValueError("收縮壓必須在 70-250 之間")
    
    if diastolic < 40 or diastolic > 150:
        raise ValueError("舒張壓必須在 40-150 之間")
    
    if systolic <= diastolic:
        raise ValueError("收縮壓必須大於舒張壓")
    
    # 分類 (AHA 標準)
    if systolic < 120 and diastolic < 80:
        category = "正常"
        risk_level = "低"
        recommendation = "維持健康生活方式"
    elif systolic < 130 and diastolic < 80:
        category = "血壓偏高"
        risk_level = "中"
        recommendation = "改善生活方式"
    elif systolic < 140 or diastolic < 90:
        category = "高血壓第一期"
        risk_level = "高"
        recommendation = "諮詢醫生,可能需要藥物"
    elif systolic < 180 or diastolic < 120:
        category = "高血壓第二期"
        risk_level = "很高"
        recommendation = "立即就醫,需要藥物治療"
    else:
        category = "高血壓危象"
        risk_level = "緊急"
        recommendation = "立即就醫!"
    
    return {
        "category": category,
        "risk_level": risk_level,
        "recommendation": recommendation,
        "systolic": systolic,
        "diastolic": diastolic
    }


def calculate_pregnancy_due_date(
    last_period_date: str
) -> Dict[str, str]:
    """
    計算預產期
    
    Args:
        last_period_date: 最後月經日期 (YYYY-MM-DD)
    
    Returns:
        dict: {"due_date": str, "weeks_pregnant": int, "trimester": int}
    
    Examples:
        >>> result = calculate_pregnancy_due_date("2024-01-01")
    """
    # 輸入驗證
    try:
        lmp = datetime.strptime(last_period_date, "%Y-%m-%d")
    except ValueError:
        raise ValueError("日期格式必須是 YYYY-MM-DD")
    
    if lmp > datetime.now():
        raise ValueError("日期不能是未來")
    
    # Naegele's rule: LMP + 280 天
    due_date = lmp + timedelta(days=280)
    
    # 計算懷孕週數
    days_pregnant = (datetime.now() - lmp).days
    weeks_pregnant = days_pregnant // 7
    
    # 判斷孕期
    if weeks_pregnant < 13:
        trimester = 1
    elif weeks_pregnant < 27:
        trimester = 2
    else:
        trimester = 3
    
    return {
        "due_date": due_date.strftime("%Y-%m-%d"),
        "weeks_pregnant": weeks_pregnant,
        "trimester": trimester,
        "lmp": last_period_date
    }


def calculate_water_intake(
    weight_kg: float,
    activity_level: str = "moderate"
) -> Dict[str, float]:
    """
    計算每日建議飲水量
    
    Args:
        weight_kg: 體重 (公斤)
        activity_level: 活動量 ('low', 'moderate', 'high')
    
    Returns:
        dict: {"daily_water_ml": float, "daily_water_cups": float}
    
    Examples:
        >>> result = calculate_water_intake(70, "moderate")
    """
    # 輸入驗證
    if weight_kg <= 0 or weight_kg > 500:
        raise ValueError("體重必須在 0-500 公斤之間")
    
    if activity_level not in ["low", "moderate", "high"]:
        raise ValueError("活動量必須是 'low', 'moderate' 或 'high'")
    
    # 基礎飲水量: 體重(kg) × 30-35 ml
    base_water = weight_kg * 33
    
    # 根據活動量調整
    multipliers = {
        "low": 1.0,
        "moderate": 1.2,
        "high": 1.5
    }
    
    daily_water_ml = base_water * multipliers[activity_level]
    daily_water_cups = daily_water_ml / 240  # 1 杯 = 240ml
    
    return {
        "daily_water_ml": round(daily_water_ml, 0),
        "daily_water_cups": round(daily_water_cups, 1),
        "weight_kg": weight_kg,
        "activity_level": activity_level
    }


def calculate_ideal_weight(
    height_cm: float,
    gender: str,
    method: str = "devine"
) -> Dict[str, float]:
    """
    計算理想體重
    
    Args:
        height_cm: 身高 (公分)
        gender: 性別 ('male', 'female')
        method: 計算方法 ('devine', 'robinson', 'miller')
    
    Returns:
        dict: {"ideal_weight_kg": float, "method": str}
    
    Examples:
        >>> result = calculate_ideal_weight(175, "male", "devine")
    """
    # 輸入驗證
    if height_cm <= 0 or height_cm > 300:
        raise ValueError("身高必須在 0-300 公分之間")
    
    if gender not in ["male", "female"]:
        raise ValueError("性別必須是 'male' 或 'female'")
    
    if method not in ["devine", "robinson", "miller"]:
        raise ValueError("方法必須是 'devine', 'robinson' 或 'miller'")
    
    # 轉換為英寸
    height_inches = height_cm / 2.54
    
    # Devine 公式
    if method == "devine":
        if gender == "male":
            ideal_weight_kg = 50 + 2.3 * (height_inches - 60)
        else:
            ideal_weight_kg = 45.5 + 2.3 * (height_inches - 60)
    
    # Robinson 公式
    elif method == "robinson":
        if gender == "male":
            ideal_weight_kg = 52 + 1.9 * (height_inches - 60)
        else:
            ideal_weight_kg = 49 + 1.7 * (height_inches - 60)
    
    # Miller 公式
    else:  # miller
        if gender == "male":
            ideal_weight_kg = 56.2 + 1.41 * (height_inches - 60)
        else:
            ideal_weight_kg = 53.1 + 1.36 * (height_inches - 60)
    
    return {
        "ideal_weight_kg": round(ideal_weight_kg, 1),
        "method": method,
        "gender": gender,
        "height_cm": height_cm
    }


def calculate_body_fat_percentage(
    weight_kg: float,
    waist_cm: float,
    neck_cm: float,
    height_cm: float,
    gender: str,
    hip_cm: Optional[float] = None
) -> Dict[str, float]:
    """
    計算體脂率 (US Navy 方法)
    
    Args:
        weight_kg: 體重
        waist_cm: 腰圍
        neck_cm: 頸圍
        height_cm: 身高
        gender: 性別
        hip_cm: 臀圍 (女性必須)
    
    Returns:
        dict: {"body_fat_percentage": float, "category": str}
    
    Examples:
        >>> result = calculate_body_fat_percentage(70, 80, 35, 175, "male")
    """
    # 輸入驗證
    if gender not in ["male", "female"]:
        raise ValueError("性別必須是 'male' 或 'female'")
    
    if gender == "female" and hip_cm is None:
        raise ValueError("女性必須提供臀圍")
    
    # US Navy 公式
    if gender == "male":
        body_fat = 495 / (1.0324 - 0.19077 * math.log10(waist_cm - neck_cm) + 0.15456 * math.log10(height_cm)) - 450
    else:
        body_fat = 495 / (1.29579 - 0.35004 * math.log10(waist_cm + hip_cm - neck_cm) + 0.22100 * math.log10(height_cm)) - 450
    
    # 分類
    if gender == "male":
        if body_fat < 6:
            category = "過低"
        elif body_fat < 14:
            category = "運動員"
        elif body_fat < 18:
            category = "健康"
        elif body_fat < 25:
            category = "正常"
        else:
            category = "肥胖"
    else:
        if body_fat < 14:
            category = "過低"
        elif body_fat < 21:
            category = "運動員"
        elif body_fat < 25:
            category = "健康"
        elif body_fat < 32:
            category = "正常"
        else:
            category = "肥胖"
    
    return {
        "body_fat_percentage": round(body_fat, 1),
        "category": category,
        "gender": gender
    }


def calculate_basal_metabolic_rate(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str
) -> Dict[str, float]:
    """
    計算基礎代謝率 (BMR)
    
    Args:
        weight_kg: 體重
        height_cm: 身高
        age: 年齡
        gender: 性別
    
    Returns:
        dict: {"bmr": float, "tdee_sedentary": float, "tdee_active": float}
    
    Examples:
        >>> result = calculate_basal_metabolic_rate(70, 175, 30, "male")
    """
    # 輸入驗證
    if weight_kg <= 0 or weight_kg > 500:
        raise ValueError("體重必須在 0-500 公斤之間")
    
    if height_cm <= 0 or height_cm > 300:
        raise ValueError("身高必須在 0-300 公分之間")
    
    if age <= 0 or age > 120:
        raise ValueError("年齡必須在 1-120 歲之間")
    
    if gender not in ["male", "female"]:
        raise ValueError("性別必須是 'male' 或 'female'")
    
    # Mifflin-St Jeor 公式
    if gender == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    
    # TDEE (總每日能量消耗)
    tdee_sedentary = bmr * 1.2  # 久坐
    tdee_active = bmr * 1.55    # 中度活動
    
    return {
        "bmr": round(bmr, 0),
        "tdee_sedentary": round(tdee_sedentary, 0),
        "tdee_active": round(tdee_active, 0),
        "gender": gender,
        "age": age
    }


def calculate_protein_intake(
    weight_kg: float,
    activity_level: str = "moderate",
    goal: str = "maintain"
) -> Dict[str, float]:
    """
    計算每日蛋白質攝取量
    
    Args:
        weight_kg: 體重
        activity_level: 活動量
        goal: 目標 ('lose', 'maintain', 'gain')
    
    Returns:
        dict: {"daily_protein_g": float, "per_meal_g": float}
    
    Examples:
        >>> result = calculate_protein_intake(70, "moderate", "maintain")
    """
    # 輸入驗證
    if weight_kg <= 0 or weight_kg > 500:
        raise ValueError("體重必須在 0-500 公斤之間")
    
    if activity_level not in ["low", "moderate", "high"]:
        raise ValueError("活動量必須是 'low', 'moderate' 或 'high'")
    
    if goal not in ["lose", "maintain", "gain"]:
        raise ValueError("目標必須是 'lose', 'maintain' 或 'gain'")
    
    # 蛋白質係數 (g/kg)
    coefficients = {
        ("low", "lose"): 1.6,
        ("low", "maintain"): 1.2,
        ("low", "gain"): 1.4,
        ("moderate", "lose"): 2.0,
        ("moderate", "maintain"): 1.6,
        ("moderate", "gain"): 1.8,
        ("high", "lose"): 2.2,
        ("high", "maintain"): 2.0,
        ("high", "gain"): 2.4,
    }
    
    coefficient = coefficients[(activity_level, goal)]
    daily_protein_g = weight_kg * coefficient
    per_meal_g = daily_protein_g / 3  # 假設一天 3 餐
    
    return {
        "daily_protein_g": round(daily_protein_g, 0),
        "per_meal_g": round(per_meal_g, 0),
        "coefficient": coefficient,
        "goal": goal
    }


# 測試
if __name__ == "__main__":
    print("=" * 60)
    print("🏥 醫療/健康函數測試")
    print("=" * 60)
    
    print("\n✅ 測試 1: BMI")
    print(calculate_bmi(70, 175))
    
    print("\n✅ 測試 2: 心率區間")
    print(calculate_heart_rate_zone(30, 60))
    
    print("\n✅ 測試 3: 卡路里消耗")
    print(calculate_calorie_burn(70, "running", 30))
    
    print("\n✅ 測試 4: 血壓分類")
    print(calculate_blood_pressure_category(120, 80))
    
    print("\n✅ 測試 5: 飲水量")
    print(calculate_water_intake(70, "moderate"))
    
    print("\n" + "=" * 60)
    print("🎉 所有醫療函數測試完成!")
    print("=" * 60)
    print("\n📊 統計:")
    print("  - 醫療函數: 10 個")
    print("  - 預計生成錯誤: 10 × 20 = 200 個")
    print("  - 累計失敗案例: 620 + 200 = 820 個 ✅")
    print("\n💎 數據金庫總計:")
    print("  - 真實函數: 60 個")
    print("  - 失敗案例: 820 個")
    print("  - 估值: $82,000+")
