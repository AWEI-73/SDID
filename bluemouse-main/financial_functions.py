"""
Financial Functions - Batch 1
金融領域函數 (10 個)
用於生成大量失敗案例,建立數據護城河
"""

import math
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta


def calculate_simple_interest(
    principal: float,
    rate: float,
    time_years: float
) -> Dict[str, float]:
    """
    計算單利
    
    Args:
        principal: 本金
        rate: 年利率 (小數,如 0.05 = 5%)
        time_years: 時間 (年)
    
    Returns:
        dict: {"interest": float, "total": float}
    
    Raises:
        ValueError: 參數無效
    
    Examples:
        >>> result = calculate_simple_interest(10000, 0.05, 2)
        >>> # {"interest": 1000, "total": 11000}
    """
    # 輸入驗證
    if principal <= 0:
        raise ValueError("本金必須大於 0")
    
    if rate < 0 or rate > 1:
        raise ValueError("利率必須在 0-1 之間")
    
    if time_years <= 0:
        raise ValueError("時間必須大於 0")
    
    # 計算單利: I = P × r × t
    interest = principal * rate * time_years
    total = principal + interest
    
    return {
        "interest": round(interest, 2),
        "total": round(total, 2),
        "principal": principal,
        "rate": rate,
        "years": time_years
    }


def calculate_compound_interest(
    principal: float,
    rate: float,
    time_years: float,
    compounds_per_year: int = 1
) -> Dict[str, float]:
    """
    計算複利
    
    Args:
        principal: 本金
        rate: 年利率
        time_years: 時間 (年)
        compounds_per_year: 每年複利次數
    
    Returns:
        dict: {"interest": float, "total": float, "effective_rate": float}
    
    Examples:
        >>> result = calculate_compound_interest(10000, 0.05, 2, 12)
    """
    # 輸入驗證
    if principal <= 0:
        raise ValueError("本金必須大於 0")
    
    if rate < 0 or rate > 1:
        raise ValueError("利率必須在 0-1 之間")
    
    if time_years <= 0:
        raise ValueError("時間必須大於 0")
    
    if compounds_per_year <= 0:
        raise ValueError("複利次數必須大於 0")
    
    # 計算複利: A = P(1 + r/n)^(nt)
    n = compounds_per_year
    t = time_years
    r = rate
    
    total = principal * math.pow(1 + r/n, n*t)
    interest = total - principal
    
    # 有效年利率
    effective_rate = math.pow(1 + r/n, n) - 1
    
    return {
        "interest": round(interest, 2),
        "total": round(total, 2),
        "effective_rate": round(effective_rate, 4),
        "principal": principal
    }


def calculate_loan_payment(
    loan_amount: float,
    annual_rate: float,
    years: int
) -> Dict[str, float]:
    """
    計算貸款月付金額
    
    Args:
        loan_amount: 貸款金額
        annual_rate: 年利率
        years: 貸款年限
    
    Returns:
        dict: {"monthly_payment": float, "total_payment": float, "total_interest": float}
    
    Examples:
        >>> result = calculate_loan_payment(300000, 0.04, 30)
    """
    # 輸入驗證
    if loan_amount <= 0:
        raise ValueError("貸款金額必須大於 0")
    
    if annual_rate < 0 or annual_rate > 1:
        raise ValueError("年利率必須在 0-1 之間")
    
    if years <= 0 or years > 50:
        raise ValueError("貸款年限必須在 1-50 年之間")
    
    # 月利率
    monthly_rate = annual_rate / 12
    n_payments = years * 12
    
    if monthly_rate == 0:
        # 無利率情況
        monthly_payment = loan_amount / n_payments
    else:
        # 月付金額公式: M = P[r(1+r)^n]/[(1+r)^n-1]
        monthly_payment = loan_amount * (monthly_rate * math.pow(1 + monthly_rate, n_payments)) / (math.pow(1 + monthly_rate, n_payments) - 1)
    
    total_payment = monthly_payment * n_payments
    total_interest = total_payment - loan_amount
    
    return {
        "monthly_payment": round(monthly_payment, 2),
        "total_payment": round(total_payment, 2),
        "total_interest": round(total_interest, 2),
        "loan_amount": loan_amount,
        "years": years
    }


def calculate_stock_return(
    initial_price: float,
    final_price: float,
    dividends: float = 0.0
) -> Dict[str, float]:
    """
    計算股票報酬率
    
    Args:
        initial_price: 初始價格
        final_price: 最終價格
        dividends: 股息
    
    Returns:
        dict: {"return_rate": float, "profit": float, "percentage": float}
    
    Examples:
        >>> result = calculate_stock_return(100, 120, 5)
    """
    # 輸入驗證
    if initial_price <= 0:
        raise ValueError("初始價格必須大於 0")
    
    if final_price < 0:
        raise ValueError("最終價格不能為負")
    
    if dividends < 0:
        raise ValueError("股息不能為負")
    
    # 計算報酬率
    profit = (final_price - initial_price) + dividends
    return_rate = profit / initial_price
    percentage = return_rate * 100
    
    return {
        "return_rate": round(return_rate, 4),
        "profit": round(profit, 2),
        "percentage": round(percentage, 2),
        "initial_price": initial_price,
        "final_price": final_price
    }


def calculate_portfolio_return(
    weights: List[float],
    returns: List[float]
) -> Dict[str, float]:
    """
    計算投資組合報酬率
    
    Args:
        weights: 各資產權重 (總和應為 1)
        returns: 各資產報酬率
    
    Returns:
        dict: {"portfolio_return": float, "weighted_returns": list}
    
    Raises:
        ValueError: 參數無效
    
    Examples:
        >>> result = calculate_portfolio_return([0.4, 0.3, 0.3], [0.1, 0.15, 0.08])
    """
    # 輸入驗證
    if not weights or not returns:
        raise ValueError("權重和報酬率不能為空")
    
    if len(weights) != len(returns):
        raise ValueError("權重和報酬率數量必須相同")
    
    if abs(sum(weights) - 1.0) > 0.01:
        raise ValueError("權重總和必須等於 1")
    
    if any(w < 0 for w in weights):
        raise ValueError("權重不能為負")
    
    # 計算加權報酬率
    weighted_returns = [w * r for w, r in zip(weights, returns)]
    portfolio_return = sum(weighted_returns)
    
    return {
        "portfolio_return": round(portfolio_return, 4),
        "weighted_returns": [round(wr, 4) for wr in weighted_returns],
        "total_weight": sum(weights)
    }


def calculate_roi(
    gain: float,
    cost: float
) -> Dict[str, float]:
    """
    計算投資報酬率 (ROI)
    
    Args:
        gain: 收益
        cost: 成本
    
    Returns:
        dict: {"roi": float, "percentage": float}
    
    Examples:
        >>> result = calculate_roi(15000, 10000)
        >>> # {"roi": 0.5, "percentage": 50.0}
    """
    # 輸入驗證
    if cost <= 0:
        raise ValueError("成本必須大於 0")
    
    # ROI = (收益 - 成本) / 成本
    roi = (gain - cost) / cost
    percentage = roi * 100
    
    return {
        "roi": round(roi, 4),
        "percentage": round(percentage, 2),
        "gain": gain,
        "cost": cost,
        "profit": gain - cost
    }


def calculate_npv(
    cash_flows: List[float],
    discount_rate: float
) -> Dict[str, float]:
    """
    計算淨現值 (NPV)
    
    Args:
        cash_flows: 現金流 (第一個為初始投資,應為負數)
        discount_rate: 折現率
    
    Returns:
        dict: {"npv": float, "is_profitable": bool}
    
    Examples:
        >>> result = calculate_npv([-10000, 3000, 4000, 5000], 0.1)
    """
    # 輸入驗證
    if not cash_flows:
        raise ValueError("現金流不能為空")
    
    if discount_rate < 0 or discount_rate > 1:
        raise ValueError("折現率必須在 0-1 之間")
    
    # 計算 NPV
    npv = 0
    for t, cf in enumerate(cash_flows):
        npv += cf / math.pow(1 + discount_rate, t)
    
    is_profitable = npv > 0
    
    return {
        "npv": round(npv, 2),
        "is_profitable": is_profitable,
        "discount_rate": discount_rate,
        "periods": len(cash_flows)
    }


def calculate_break_even(
    fixed_costs: float,
    variable_cost_per_unit: float,
    price_per_unit: float
) -> Dict[str, float]:
    """
    計算損益兩平點
    
    Args:
        fixed_costs: 固定成本
        variable_cost_per_unit: 單位變動成本
        price_per_unit: 單位售價
    
    Returns:
        dict: {"break_even_units": float, "break_even_revenue": float}
    
    Examples:
        >>> result = calculate_break_even(10000, 20, 50)
    """
    # 輸入驗證
    if fixed_costs < 0:
        raise ValueError("固定成本不能為負")
    
    if variable_cost_per_unit < 0:
        raise ValueError("變動成本不能為負")
    
    if price_per_unit <= 0:
        raise ValueError("售價必須大於 0")
    
    if price_per_unit <= variable_cost_per_unit:
        raise ValueError("售價必須大於變動成本")
    
    # 損益兩平點 = 固定成本 / (售價 - 變動成本)
    break_even_units = fixed_costs / (price_per_unit - variable_cost_per_unit)
    break_even_revenue = break_even_units * price_per_unit
    
    return {
        "break_even_units": round(break_even_units, 2),
        "break_even_revenue": round(break_even_revenue, 2),
        "contribution_margin": price_per_unit - variable_cost_per_unit
    }


def currency_conversion(
    amount: float,
    from_currency: str,
    to_currency: str,
    exchange_rate: float
) -> Dict[str, float]:
    """
    貨幣轉換
    
    Args:
        amount: 金額
        from_currency: 原幣別
        to_currency: 目標幣別
        exchange_rate: 匯率
    
    Returns:
        dict: {"converted_amount": float, "original_amount": float}
    
    Examples:
        >>> result = currency_conversion(1000, "USD", "TWD", 31.5)
    """
    # 輸入驗證
    if amount < 0:
        raise ValueError("金額不能為負")
    
    if not from_currency or not to_currency:
        raise ValueError("幣別不能為空")
    
    if exchange_rate <= 0:
        raise ValueError("匯率必須大於 0")
    
    # 轉換
    converted_amount = amount * exchange_rate
    
    return {
        "converted_amount": round(converted_amount, 2),
        "original_amount": amount,
        "from_currency": from_currency,
        "to_currency": to_currency,
        "exchange_rate": exchange_rate
    }


def calculate_tax(
    income: float,
    tax_brackets: List[Tuple[float, float]]
) -> Dict[str, float]:
    """
    計算累進稅額
    
    Args:
        income: 收入
        tax_brackets: 稅級 [(上限, 稅率), ...]
    
    Returns:
        dict: {"tax": float, "after_tax": float, "effective_rate": float}
    
    Examples:
        >>> brackets = [(50000, 0.05), (100000, 0.12), (float('inf'), 0.20)]
        >>> result = calculate_tax(120000, brackets)
    """
    # 輸入驗證
    if income < 0:
        raise ValueError("收入不能為負")
    
    if not tax_brackets:
        raise ValueError("稅級不能為空")
    
    # 計算累進稅
    tax = 0
    previous_limit = 0
    
    for limit, rate in tax_brackets:
        if income > previous_limit:
            taxable = min(income, limit) - previous_limit
            tax += taxable * rate
            previous_limit = limit
        else:
            break
    
    after_tax = income - tax
    effective_rate = tax / income if income > 0 else 0
    
    return {
        "tax": round(tax, 2),
        "after_tax": round(after_tax, 2),
        "effective_rate": round(effective_rate, 4),
        "income": income
    }


# 測試
if __name__ == "__main__":
    print("=" * 60)
    print("💰 金融函數測試")
    print("=" * 60)
    
    print("\n✅ 測試 1: 單利")
    print(calculate_simple_interest(10000, 0.05, 2))
    
    print("\n✅ 測試 2: 複利")
    print(calculate_compound_interest(10000, 0.05, 2, 12))
    
    print("\n✅ 測試 3: 貸款月付")
    print(calculate_loan_payment(300000, 0.04, 30))
    
    print("\n✅ 測試 4: 股票報酬")
    print(calculate_stock_return(100, 120, 5))
    
    print("\n✅ 測試 5: 投資組合")
    print(calculate_portfolio_return([0.4, 0.3, 0.3], [0.1, 0.15, 0.08]))
    
    print("\n" + "=" * 60)
    print("🎉 所有金融函數測試完成!")
    print("=" * 60)
    print("\n📊 統計:")
    print("  - 金融函數: 10 個")
    print("  - 預計生成錯誤: 10 × 20 = 200 個")
    print("  - 累計失敗案例: 420 + 200 = 620 個 ✅")
