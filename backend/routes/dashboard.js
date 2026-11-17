
const express = require("express");
const pool = require("../config/database");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);
router.use(authorize(
    "admin",
    "doctor",
    "receptionist",
    "accountant"
));

// Dashboard summary
router.get("/", async (req, res) => {
    try {
        const [[patients]] = await pool.execute(
            "SELECT COUNT(*) AS total FROM patients"
        );

        const [[doctors]] = await pool.execute(
            "SELECT COUNT(*) AS total FROM doctors"
        );

        const [[appointments]] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM appointments
             WHERE status = 'scheduled'`
        );

        const [[revenue]] = await pool.execute(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM payments`
        );

        const [[stats]] = await pool.execute(
            `SELECT
                SUM(status = 'scheduled') AS scheduled,
                SUM(status = 'completed') AS completed,
                SUM(status = 'cancelled') AS cancelled
             FROM appointments`
        );

        const [recent] = await pool.execute(
            `SELECT
                p.name AS patientName,
                u.name AS doctorName,
                a.appointment_date AS appointmentDate,
                a.status
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN doctors d ON a.doctor_id = d.id
             JOIN users u ON d.user_id = u.id
             ORDER BY a.appointment_date DESC
             LIMIT 8`
        );

        res.json({
            totalPatients: patients.total,
            totalDoctors: doctors.total,
            totalAppointments: appointments.total,
            totalRevenue: revenue.total,
            appointmentStats: {
                scheduled: Number(stats.scheduled || 0),
                completed: Number(stats.completed || 0),
                cancelled: Number(stats.cancelled || 0)
            },
            recentAppointments: recent
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load dashboard"
        });
    }
});

// Revenue chart
router.get("/revenue", async (req, res) => {
    try {
        const months = Math.min(
            12,
            Math.max(1, parseInt(req.query.months, 10) || 6)
        );

        const [rows] = await pool.execute(
            `SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                SUM(amount) AS revenue
             FROM payments
             WHERE created_at >=
                DATE_FORMAT(
                    DATE_SUB(CURDATE(), INTERVAL ? MONTH),
                    '%Y-%m-01'
                )
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month`,
            [months - 1]
        );

        const values = new Map(
            rows.map(row => [
                row.month,
                Number(row.revenue)
            ])
        );

        const labels = [];
        const chartValues = [];

        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );

            const key =
                `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                ).padStart(2, "0")}`;

            labels.push(
                date.toLocaleString("en-US", {
                    month: "short",
                    year: "2-digit"
                })
            );

            chartValues.push(values.get(key) || 0);
        }

        res.json({
            labels,
            values: chartValues
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load revenue"
        });
    }
});

module.exports = router;
