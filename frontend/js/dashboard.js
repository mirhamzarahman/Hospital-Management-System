
document.addEventListener("DOMContentLoaded", () => {

    // DATE
    const dateElement = document.getElementById("currentDate");

    dateElement.textContent = new Date().toLocaleDateString(
        "en-US",
        {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );

    // USER INFORMATION
    const savedUser = sessionStorage.getItem("hms_user");

    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);

            document.getElementById("adminName").textContent =
                user.name || "Administrator";

            document.querySelector(".profile-info span").textContent =
                user.role || "Hospital Admin";
        } catch {
            console.error("Invalid user session");
        }
    }

    // THEME
    const themeToggle = document.getElementById("themeToggle");

    const savedTheme = localStorage.getItem("hms_theme");

    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        themeToggle.textContent = "☾";
    }

    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");

        const isLight = document.body.classList.contains("light-theme");

        localStorage.setItem(
            "hms_theme",
            isLight ? "light" : "dark"
        );

        themeToggle.textContent = isLight ? "☾" : "☀";

        updateChartColors();
    });

    // MOBILE SIDEBAR
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");

    menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 850 &&
            !sidebar.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });

    // LOGOUT
    document.getElementById("logoutBtn").addEventListener("click", () => {
        sessionStorage.removeItem("hms_token");
        sessionStorage.removeItem("hms_user");
        window.location.href = "login.html";
    });

    // CHARTS
    initializeCharts();

    // LOAD DASHBOARD DATA
    loadDashboard();

    // REVENUE FILTER
    document.getElementById("revenuePeriod").addEventListener(
        "change",
        event => loadRevenue(event.target.value)
    );

    // SEARCH
    document.getElementById("globalSearch").addEventListener(
        "input",
        event => {
            const query = event.target.value.toLowerCase();

            document.querySelectorAll(
                "#appointmentsTable tr"
            ).forEach(row => {
                row.style.display =
                    row.textContent.toLowerCase().includes(query)
                        ? ""
                        : "none";
            });
        }
    );
});

let revenueChart;
let patientChart;

function initializeCharts() {
    const isLight =
        document.body.classList.contains("light-theme");

    const textColor = isLight ? "#64748b" : "#94a3b8";
    const gridColor = isLight ? "#e2e8f0" : "#263449";

    revenueChart = new Chart(
        document.getElementById("revenueChart"),
        {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "Revenue",
                    data: [],
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59,130,246,.15)",
                    borderWidth: 3,
                    fill: true,
                    tension: .4,
                    pointRadius: 4,
                    pointBackgroundColor: "#3b82f6"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        }
    );

    patientChart = new Chart(
        document.getElementById("patientChart"),
        {
            type: "doughnut",
            data: {
                labels: ["Scheduled", "Completed", "Cancelled"],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        "#3b82f6",
                        "#10b981",
                        "#ef4444"
                    ],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "72%",
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: textColor,
                            padding: 18
                        }
                    }
                }
            }
        }
    );
}

function updateChartColors() {
    const isLight =
        document.body.classList.contains("light-theme");

    const color = isLight ? "#64748b" : "#94a3b8";
    const grid = isLight ? "#e2e8f0" : "#263449";

    [revenueChart, patientChart].forEach(chart => {
        if (!chart) return;

        if (chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = color;
        }

        if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
                scale.ticks.color = color;

                if (scale.grid) {
                    scale.grid.color = grid;
                }
            });
        }

        chart.update();
    });
}

async function loadDashboard() {
    try {
        const data = await API.get("/dashboard");

        document.getElementById("totalPatients").textContent =
            Number(data.totalPatients || 0).toLocaleString();

        document.getElementById("totalDoctors").textContent =
            Number(data.totalDoctors || 0).toLocaleString();

        document.getElementById("totalAppointments").textContent =
            Number(data.totalAppointments || 0).toLocaleString();

        document.getElementById("totalRevenue").textContent =
            formatCurrency(data.totalRevenue || 0);

        renderAppointments(data.recentAppointments || []);

        loadRevenue(6);

        patientChart.data.datasets[0].data = [
            data.appointmentStats?.scheduled || 0,
            data.appointmentStats?.completed || 0,
            data.appointmentStats?.cancelled || 0
        ];

        patientChart.update();

    } catch (error) {
        console.error("Dashboard loading error:", error);

        document.getElementById("appointmentsTable").innerHTML = `
            <tr>
                <td colspan="4" class="loading">
                    Unable to load dashboard data.
                    Check your backend connection.
                </td>
            </tr>
        `;
    }
}

async function loadRevenue(months) {
    try {
        const data = await API.get(
            `/dashboard/revenue?months=${months}`
        );

        revenueChart.data.labels = data.labels || [];
        revenueChart.data.datasets[0].data = data.values || [];

        revenueChart.update();

    } catch (error) {
        console.error("Revenue loading error:", error);
    }
}

function renderAppointments(appointments) {
    const tbody = document.getElementById("appointmentsTable");

    if (!appointments.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    No appointments found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = appointments.map(item => {
        const status = String(item.status || "scheduled")
            .toLowerCase();

        const safeStatus = [
            "scheduled",
            "completed",
            "cancelled"
        ].includes(status) ? status : "pending";

        const patient = escapeHTML(item.patientName);
        const doctor = escapeHTML(item.doctorName);

        const date = item.appointmentDate
            ? new Date(item.appointmentDate).toLocaleDateString()
            : "N/A";

        return `
            <tr>
                <td>${patient}</td>
                <td>${doctor}</td>
                <td>${date}</td>
                <td>
                    <span class="status ${safeStatus}">
                        ${safeStatus}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency: "BDT",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}
