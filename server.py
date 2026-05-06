"""
Flask server สำหรับดึงราคาหุ้นไทยจาก Yahoo Finance (yfinance)
รัน: python server.py
จากนั้นเปิด index.html จะดึงราคาจริงจาก /api/stocks
"""

from flask import Flask, jsonify
from flask_cors import CORS
import yfinance as yf
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

STOCKS = {
    "PTT":   {"ticker": "PTT.BK",    "name": "ปตท."},
    "AOT":   {"ticker": "AOT.BK",    "name": "ท่าอากาศยาน"},
    "ADVA":  {"ticker": "ADVANC.BK", "name": "แอดวานซ์ อินโฟ"},
    "CPALL": {"ticker": "CPALL.BK",  "name": "ซีพี ออลล์"},
    "KBANK": {"ticker": "KBANK.BK",  "name": "กสิกรไทย"},
    "SCB":   {"ticker": "SCB.BK",    "name": "ไทยพาณิชย์"},
}

# ราคา fallback กรณี API ไม่ตอบ
FALLBACK_PRICES = {
    "PTT":   35.0,
    "AOT":   72.0,
    "ADVA":  220.0,
    "CPALL": 58.0,
    "KBANK": 145.0,
    "SCB":   105.0,
}


def fetch_history(ticker_symbol: str, days: int = 30) -> list[float]:
    """ดึงราคาปิด 30 วันล่าสุด"""
    end = datetime.today()
    start = end - timedelta(days=days + 14)  # buffer สำหรับวันหยุด
    df = yf.download(ticker_symbol, start=start.strftime("%Y-%m-%d"),
                     end=end.strftime("%Y-%m-%d"), interval="1d", progress=False)
    if df.empty:
        return []
    closes = df["Close"].dropna().tolist()
    # ถ้าเป็น list ซ้อน (multi-index) ให้ flatten
    result = []
    for v in closes:
        try:
            result.append(round(float(v), 2))
        except (TypeError, ValueError):
            pass
    return result[-days:]  # คืนแค่ 30 วันล่าสุด


@app.route("/api/stocks")
def get_stocks():
    """
    คืนค่า JSON รายการหุ้นพร้อม:
      - currentPrice: ราคาปัจจุบัน (ปิดล่าสุด)
      - history: ราคาปิดย้อนหลัง 30 วัน
      - source: "live" | "fallback"
    """
    result = {}
    for sym, info in STOCKS.items():
        try:
            history = fetch_history(info["ticker"])
            if history:
                result[sym] = {
                    "symbol": sym,
                    "name": info["name"],
                    "currentPrice": history[-1],
                    "history": history,
                    "source": "live",
                }
                log.info("✅ %s: ฿%.2f (%d days)", sym, history[-1], len(history))
            else:
                raise ValueError("empty data")
        except Exception as e:
            log.warning("⚠️  %s fallback (%s)", sym, e)
            result[sym] = {
                "symbol": sym,
                "name": info["name"],
                "currentPrice": FALLBACK_PRICES[sym],
                "history": [FALLBACK_PRICES[sym]],
                "source": "fallback",
            }

    live_count = sum(1 for v in result.values() if v["source"] == "live")
    return jsonify({"stocks": result, "liveCount": live_count, "total": len(result)})


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("🚀  Stock API server running at http://localhost:5000")
    print("    GET /api/stocks  → ราคาหุ้นไทย 6 ตัว")
    app.run(debug=True, port=5000)
