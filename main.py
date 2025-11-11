import tushare as ts
import backtrader as bt
import matplotlib.pyplot as plt
import pandas as pd

# 1. 设置Tushare token（需注册Tushare账号，在个人中心获取）
from constants import TUSHARE_TOKEN
ts.set_token(TUSHARE_TOKEN)
pro = ts.pro_api()

# 2. 获取股票历史数据（以贵州茅台为例，代码600519.SH，时间2020-2023年）
def get_stock_data(stock_code, start_date, end_date):
    df = pro.daily(ts_code=stock_code, start_date=start_date, end_date=end_date)
    # 调整数据格式（Backtrader要求的列名和顺序）
    df = df[["trade_date", "open", "high", "low", "close", "vol"]]
    df.columns = ["date", "open", "high", "low", "close", "volume"]
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")  # 按时间正序排列
    df.set_index("date", inplace=True)
    return df

# 3. 定义均线交叉策略
class MA_Cross_Strategy(bt.Strategy):
    params = (
        ("short_period", 5),  # 短期均线（5日均线）
        ("long_period", 20),   # 长期均线（20日均线）
    )

    def __init__(self):
        # 初始化两条均线
        self.short_ma = bt.indicators.SimpleMovingAverage(
            self.data.close, period=self.params.short_period
        )
        self.long_ma = bt.indicators.SimpleMovingAverage(
            self.data.close, period=self.params.long_period
        )
        # 交叉信号（短期上穿长期=金叉，下穿=死叉）
        self.crossover = bt.indicators.CrossOver(self.short_ma, self.long_ma)

    def next(self):
        # 无持仓时，金叉买入
        if not self.position and self.crossover > 0:
            self.buy(size=100)  # 买入100股（新手可设小仓位）
        # 有持仓时，死叉卖出
        elif self.position and self.crossover < 0:
            self.sell(size=100)  # 卖出100股

# 4. 运行回测
if __name__ == "__main__":
    # 获取数据
    stock_data = get_stock_data("600519.SH", "20200101", "20231231")
    # 构建回测引擎
    cerebro = bt.Cerebro()
    # 添加策略
    cerebro.addstrategy(MA_Cross_Strategy)
    # 添加数据到引擎
    data_feed = bt.feeds.PandasData(dataname=stock_data)
    cerebro.adddata(data_feed)
    # 设置初始资金（10万元）
    cerebro.broker.setcash(100000.0)
    # 设置交易成本（手续费0.1%），注意：印花税暂未计算
    cerebro.broker.setcommission(commission=0.001)
    # 打印回测前资金
    print(f"初始资金：{cerebro.broker.getvalue():.2f} 元")
    # 运行回测
    cerebro.run()
    # 打印回测后资金
    print(f"回测后资金：{cerebro.broker.getvalue():.2f} 元")
    # 绘制回测图表（K线、均线、买卖信号）
    cerebro.plot(style="candlestick")
    plt.show()
