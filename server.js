const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 初始化資料庫
const db = new sqlite3.Database('./health.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS health_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_date DATE NOT NULL,
        sleep_hours REAL NOT NULL,
        steps INTEGER NOT NULL,
        mood_score INTEGER NOT NULL,
        risk_level TEXT
    )`);

    // 每次啟動清空舊資料
    db.run(`DELETE FROM health_logs`);

    const insertStmt = db.prepare(`INSERT INTO health_logs (log_date, sleep_hours, steps, mood_score, risk_level) VALUES (?, ?, ?, ?, ?)`);

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 90);
    let dayCount = 0;

    function getRnd(min, max, isInt = false) {
        if (isInt) return Math.floor(Math.random() * (max - min + 1)) + min;
        return parseFloat((Math.random() * (max - min) + min).toFixed(1));
    }

    for (let i = 0; i < 25; i++) {
        const d = new Date(baseDate); d.setDate(d.getDate() + dayCount++);
        insertStmt.run(d.toISOString().substring(0, 10), getRnd(4.0, 5.5), getRnd(1000, 3500, true), getRnd(1, 4, true), "高風險");
    }
    for (let i = 0; i < 40; i++) {
        const d = new Date(baseDate); d.setDate(d.getDate() + dayCount++);
        insertStmt.run(d.toISOString().substring(0, 10), getRnd(6.0, 7.5), getRnd(4000, 5500, true), getRnd(5, 7, true), "中風險");
    }
    for (let i = 0; i < 25; i++) {
        const d = new Date(baseDate); d.setDate(d.getDate() + dayCount++);
        insertStmt.run(d.toISOString().substring(0, 10), getRnd(7.0, 9.0), getRnd(6000, 10000, true), getRnd(7, 10, true), "低風險");
    }
    insertStmt.finalize();
});

// 2. 決策樹邏輯
function calculateRiskTree(sleep, steps, mood) {
    if (sleep < 6.0) {
        if (steps < 4000) {
            if (mood <= 4) return "高風險";
            else return "中風險";
        } else return "中風險";
    } else {
        if (steps >= 6000) {
            if (mood >= 6) return "低風險";
            else return "中風險";
        } else return "中風險";
    }
}

// 3. API 路由 (五個端點全開)

// [GET] 取得所有歷史紀錄
app.get('/api/health-logs', (req, res) => {
    db.all(`SELECT * FROM health_logs ORDER BY log_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// [GET] 快速測試風險 (不存檔)
app.get('/api/health-logs/risk', (req, res) => {
    const sleep = parseFloat(req.query.sleep) || 0;
    const steps = parseInt(req.query.steps) || 0;
    const mood = parseInt(req.query.mood) || 0;
    res.json({ status: "success", riskLevel: calculateRiskTree(sleep, steps, mood) });
});

// [POST] 新增日誌
app.post('/api/health-logs', (req, res) => {
    const { logDate, sleepHours, steps, moodScore } = req.body;
    const risk = calculateRiskTree(sleepHours, steps, moodScore);
    db.run(`INSERT INTO health_logs (log_date, sleep_hours, steps, mood_score, risk_level) VALUES (?, ?, ?, ?, ?)`,
        [logDate, sleepHours, steps, moodScore, risk],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: "success", riskLevel: risk });
        }
    );
});

// [PUT] 修改指定日誌
app.put('/api/health-logs/:id', (req, res) => {
    const { logDate, sleepHours, steps, moodScore } = req.body;
    const newRisk = calculateRiskTree(sleepHours, steps, moodScore);
    db.run(`UPDATE health_logs SET log_date = ?, sleep_hours = ?, steps = ?, mood_score = ?, risk_level = ? WHERE id = ?`,
        [logDate, sleepHours, steps, moodScore, newRisk, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: "success", newRiskLevel: newRisk });
        }
    );
});

// [DELETE] 刪除日誌
app.delete('/api/health-logs/:id', (req, res) => {
    db.run(`DELETE FROM health_logs WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ status: "success" });
    });
});

app.listen(3000, () => console.log(`🚀 伺服器已啟動: http://localhost:3000`));