/**
 * PROJECT PLANNING TOOL - SCRIPT.JS (FULL VERSION)
 */

// ==========================================
// 1. CONFIGURATION & AUTH GUARD
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzQ6dapjAmqtx-Ud2l3E84C1Zg8Bsjh8ewPbPOOcCce9Ay6AMBGyHSjEq3GzP0aTW_ZYQ/exec';

// ตรวจสอบการ Login
const storedUser = sessionStorage.getItem('currentUser');
if (!storedUser) {
    window.location.href = 'login.html';
}
const currentUser = JSON.parse(storedUser);

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let users = [];
let tasks = [];
let holidays = [];
let currentDate = new Date();
let daysInView = [];
let collapsedUsers = new Set(); // เก็บ ID พนักงานที่ถูกพับแถว
let currentDetailTask = null;

// ==========================================
// 3. INITIALIZATION
// ==========================================
// ตรวจสอบธีมที่บันทึกไว้ใน localStorage ตอนโหลดหน้าเว็บ
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
}


document.addEventListener('DOMContentLoaded', () => {
    // แสดงชื่อและ Avatar ของผู้ใช้งานปัจจุบัน
    document.getElementById('current-user-name').textContent = currentUser.Name;
    const avatar = document.getElementById('current-user-avatar');
    avatar.textContent = currentUser.Name.charAt(0);
    avatar.style.backgroundColor = currentUser.Color;

    // Sync การเลื่อน Header กับ Body ของ Timeline
    const timelineBody = document.getElementById('timeline-body');
    const calendarHeaderWrapper = document.getElementById('calendar-header-wrapper');
    if (timelineBody && calendarHeaderWrapper) {
        timelineBody.addEventListener('scroll', () => {
            calendarHeaderWrapper.scrollLeft = timelineBody.scrollLeft;
        });
    }

    // ค้นหาฟังก์ชัน setupEventListeners() เดิมของคุณ แล้วเพิ่มโค้ดชุดนี้เข้าไปด้านในครับ
function setupEventListeners() {
    // ... โค้ดอีเวนต์อื่นๆ ที่มีอยู่แล้ว ...

    // ฟังก์ชันสำหรับสลับธีม Dark / Light
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            
            // บันทึกสถานะลง localStorage เพื่อจำธีมในครั้งต่อไป
            if (document.body.classList.contains('light-theme')) {
                localStorage.setItem('theme', 'light');
            } else {
                localStorage.setItem('theme', 'dark');
            }
        });
    }
}
    fetchData(); // โหลดข้อมูลจาก Google Sheets
});

// ==========================================
// 4. DATA FETCHING (API)
// ==========================================
async function fetchData() {
    try {
        console.log("Fetching cloud data...");
        const [uRes, tRes, hRes] = await Promise.all([
            fetch(`${API_URL}?action=getUsers`).then(r => r.json()),
            fetch(`${API_URL}?action=getTasks`).then(r => r.json()),
            fetch(`${API_URL}?action=getHolidays`).then(r => r.json())
        ]);
        
        users = uRes;
        tasks = tRes.map(t => ({ ...t, TaskID: t.TaskID.toString() }));
        holidays = hRes;
        
        populateAssigneeOptions();
        refreshUI();
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("ไม่สามารถโหลดข้อมูลจาก Server ได้");
    }
}

function refreshUI() {
    renderCalendar();
    renderTimeline();
    renderMyTasksSidebar();
}

// ==========================================
// 5. RENDERING (CALENDAR & TIMELINE)
// ==========================================

function renderCalendar() {
    const calendarHeader = document.getElementById('calendar-header');
    const monthDisplay = document.getElementById('current-month-display');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthDisplay.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    calendarHeader.innerHTML = '';
    daysInView = [];
    calendarHeader.style.width = `${daysInMonth * 40}px`;

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateStr = formatDateStr(date);
        daysInView.push(date);

        const dayEl = document.createElement('div');
        dayEl.className = 'day-cell';
        if (date.toDateString() === new Date().toDateString()) dayEl.classList.add('today');
        if (date.getDay() === 0 || date.getDay() === 6) dayEl.classList.add('weekend');
        
        const isHoliday = holidays.find(h => h.Date === dateStr);
        if (isHoliday) {
            dayEl.classList.add('special-holiday');
            dayEl.title = isHoliday.Name;
            dayEl.style.color = '#ef4444';
        }

        dayEl.innerHTML = `
            <div style="font-size:0.65rem; opacity:0.7;">${date.toLocaleDateString('en', {weekday:'short'}).toUpperCase()}</div>
            <div style="font-weight:600;">${i}</div>
        `;
        calendarHeader.appendChild(dayEl);
    }
}

function renderTimeline() {
    const timelineBody = document.getElementById('timeline-body');
    timelineBody.innerHTML = '';
    
    const TASK_H = 32;
    const GAP = 8;
    const PADDING_V = 15;

    users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        // ตรวจสอบสถานะการพับแถว
        const isCollapsed = collapsedUsers.has(user.EmployeeID);
        if (isCollapsed) {
    row.classList.add('collapsed');
}
        

        // 1. คำนวณระบบชั้นบันได (Stacking Logic)
        let userTasks = tasks.filter(t => t.AssignedTo == user.EmployeeID);
        userTasks.sort((a, b) => parseDateLocal(a.StartDate) - parseDateLocal(b.StartDate));

        let levels = []; // เก็บวันที่สิ้นสุดของงานในแต่ละชั้น
        userTasks.forEach(task => {
            const start = parseDateLocal(task.StartDate);
            const end = parseDateLocal(task.EndDate);
            let assignedLevel = -1;

            for (let i = 0; i < levels.length; i++) {
                if (start > levels[i]) {
                    assignedLevel = i;
                    levels[i] = end;
                    break;
                }
            }
            if (assignedLevel === -1) {
                assignedLevel = levels.length;
                levels.push(end);
            }
            task._level = assignedLevel;
        });

        // กำหนดความสูงแถวตามจำนวนชั้นงาน
        const rowHeight = Math.max(65, (levels.length * (TASK_H + GAP)) + (PADDING_V * 2));
        row.style.height = `${rowHeight}px`;

        // 2. ชื่อพนักงาน (User Cell) + ปุ่มยุบแถว
        const userCell = document.createElement('div');
        userCell.className = 'user-cell';
        userCell.title = "Click to Hide/Show Tracks";
        userCell.innerHTML = `
            <div class="avatar" style="background-color:${user.Color}; width:24px; height:24px; font-size:0.7rem; margin-right:8px;">${user.Name.charAt(0)}</div>
            <span style="font-size:0.85rem; font-weight:500;">${user.Name}</span>
            <div class="toggle-icon">▼</div>
        `;
        
        userCell.onclick = () => {
            if (collapsedUsers.has(user.EmployeeID)) collapsedUsers.delete(user.EmployeeID);
            else collapsedUsers.add(user.EmployeeID);
            renderTimeline();
        };
        row.appendChild(userCell);

        // 3. Track พื้นที่วางงาน
        const track = document.createElement('div');
        track.className = 'timeline-track';
        track.style.width = `${daysInView.length * 40}px`;

        // 4. วาดแถบแนวตั้งแสดงวันหยุด/เสาร์-อาทิตย์
        daysInView.forEach((date, idx) => {
            const dateStr = formatDateStr(date);
            const isHoliday = holidays.find(h => h.Date === dateStr);
            const isWeekend = (date.getDay() === 0 || date.getDay() === 6);

            if (isHoliday || isWeekend) {
                const band = document.createElement('div');
                band.className = isHoliday ? 'holiday-col' : 'weekend-col';
                band.style.left = `${idx * 40}px`;
                track.appendChild(band);
            }
        });

        // 5. วาด Task กราฟงาน
        userTasks.forEach(task => {
            const start = parseDateLocal(task.StartDate);
            const end = parseDateLocal(task.EndDate);
            const vStart = daysInView[0];
            const vEnd = daysInView[daysInView.length - 1];

            if (end < vStart || start > vEnd) return;

            const dStart = start < vStart ? vStart : start;
            const dEnd = end > vEnd ? vEnd : end;

            const left = Math.floor((dStart - vStart) / 86400000) * 40;
            const width = (Math.floor((dEnd - dStart) / 86400000) + 1) * 40;
            const top = PADDING_V + (task._level * (TASK_H + GAP));

            const taskEl = document.createElement('div');
            taskEl.className = 'task-bar';
            taskEl.style.left = `${left}px`;
            taskEl.style.width = `${width}px`;
            taskEl.style.top = `${top}px`;
            taskEl.style.backgroundColor = user.Color;
            
            const statusColors = { 'Completed': '#22c55e', 'In Progress': '#3b82f6', 'Pending': '#fbbf24' };
            taskEl.style.borderLeft = `4px solid ${statusColors[task.Status] || '#ccc'}`;

            taskEl.innerHTML = `<span class="task-title-text">${task.Title}</span>`;
            taskEl.onclick = (e) => { 
                e.stopPropagation(); // ไม่ให้ไปพับแถวเวลาคลิกงาน
                openTaskDetails(task); 
            };
            track.appendChild(taskEl);
        });

        row.appendChild(track);
        timelineBody.appendChild(row);
    });
}

// ==========================================
// 6. TASK MANAGEMENT (CRUD)
// ==========================================

// Add Task Submit
document.getElementById('task-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const newTask = {
        TaskID: Date.now().toString(),
        Title: document.getElementById('task-title').value,
        StartDate: document.getElementById('task-start').value,
        EndDate: document.getElementById('task-end').value,
        AssignedTo: parseInt(document.getElementById('task-assignee').value),
        Status: 'Pending',
        Description: document.getElementById('task-desc').value
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addTask', ...newTask })
        });
        tasks.push(newTask);
        refreshUI();
        document.getElementById('task-modal').classList.remove('active');
        e.target.reset();
    } catch (err) { alert("เกิดข้อผิดพลาดในการบันทึก"); }
    finally { btn.disabled = false; btn.textContent = 'Create Task'; }
};

// Edit Task Save
document.getElementById('save-edit-btn').onclick = async () => {
    if (!currentDetailTask) return;
    
    const updated = {
        ...currentDetailTask,
        Title: document.getElementById('detail-title').value,
        Description: document.getElementById('detail-desc').value,
        StartDate: document.getElementById('detail-start').value,
        EndDate: document.getElementById('detail-end').value,
        Status: document.getElementById('detail-status').value
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'editTask', task: updated })
        });
        const idx = tasks.findIndex(t => t.TaskID === updated.TaskID);
        tasks[idx] = updated;
        refreshUI();
        document.getElementById('task-details-modal').classList.remove('active');
    } catch (err) { alert("ไม่สามารถแก้ไขได้"); }
};

// Delete Task
document.getElementById('delete-task-btn').onclick = async () => {
    if (!currentDetailTask || !confirm("ยืนยันการลบงานนี้?")) return;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteTask', taskID: currentDetailTask.TaskID })
        });
        tasks = tasks.filter(t => t.TaskID !== currentDetailTask.TaskID);
        refreshUI();
        document.getElementById('task-details-modal').classList.remove('active');
    } catch (err) { alert("ไม่สามารถลบได้"); }
};

// ==========================================
// 7. MODALS & SIDEBAR UTILS
// ==========================================

function openTaskDetails(task) {
    currentDetailTask = task;
    document.getElementById('detail-title').value = task.Title;
    document.getElementById('detail-desc').value = task.Description || '';
    document.getElementById('detail-start').value = task.StartDate;
    document.getElementById('detail-end').value = task.EndDate;
    document.getElementById('detail-status').value = task.Status;
    
    // สิทธิ์การแก้ไข (เฉพาะเจ้าของงาน)
    const isOwner = (task.AssignedTo == currentUser.EmployeeID);
    document.getElementById('edit-task-btn').classList.toggle('hidden', !isOwner);
    document.getElementById('delete-task-btn').classList.toggle('hidden', !isOwner);
    
    setDetailEditMode(false);
    updateCountdown(task);
    document.getElementById('task-details-modal').classList.add('active');
}

function setDetailEditMode(isEdit) {
    const fields = ['detail-title', 'detail-desc', 'detail-start', 'detail-end', 'detail-status'];
    fields.forEach(id => document.getElementById(id).disabled = !isEdit);
    document.getElementById('detail-actions-view').classList.toggle('hidden', isEdit);
    document.getElementById('detail-actions-edit').classList.toggle('hidden', !isEdit);
}

function renderMyTasksSidebar() {
    const list = document.getElementById('my-task-list');
    const countBadge = document.getElementById('my-task-count');
    
    // 1. กรองเฉพาะงานของฉันที่ยังไม่เสร็จ
    const myTasks = tasks.filter(t => t.AssignedTo == currentUser.EmployeeID && t.Status !== 'Completed');

    // 2. เรียงตามวันสิ้นสุด (Due Date) ใครใกล้ถึงกำหนดที่สุดอยู่บน
    myTasks.sort((a, b) => parseDateLocal(a.EndDate) - parseDateLocal(b.EndDate));

    countBadge.textContent = myTasks.length;

    if (myTasks.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); margin-top:2rem; animation:fadeInUp 0.5s;">
                <p style="font-size:1.5rem;">🎉</p>
                <p style="font-size:0.8rem;">No pending tasks!</p>
            </div>`;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    list.innerHTML = myTasks.map((t, index) => {
        const endDate = parseDateLocal(t.EndDate);
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // คำนวณความเร่งด่วน
        let urgencyClass = 'safe';
        let statusText = `${diffDays} days left`;

        if (diffDays < 0) {
            urgencyClass = 'overdue';
            statusText = `Overdue ${Math.abs(diffDays)}d`;
        } else if (diffDays === 0) {
            urgencyClass = 'warning';
            statusText = `Due Today!`;
        } else if (diffDays <= 3) {
            urgencyClass = 'warning';
            statusText = `${diffDays}d left`;
        }

        // เพิ่ม staggered delay ให้ animation
        const delay = index * 0.05;

        return `
            <div class="mini-task-card ${urgencyClass}" 
                 style="animation-delay: ${delay}s" 
                 onclick="openTaskDetailsById('${t.TaskID}')">
                <div class="mini-task-title">${t.Title}</div>
                <div class="mini-task-due-info">
                    <span style="color:var(--text-muted)">📅 Due: ${t.EndDate}</span>
                    <span class="urgency-text">${statusText}</span>
                </div>
            </div>
        `;
    }).join('');
}

function openTaskDetailsById(id) {
    const task = tasks.find(t => t.TaskID === id);
    if(task) openTaskDetails(task);
}

function updateCountdown(task) {
    const box = document.getElementById('countdown-box');
    const val = document.getElementById('countdown-value');
    if (task.Status === 'Completed') {
        box.classList.add('hidden');
    } else {
        const diff = Math.ceil((parseDateLocal(task.EndDate) - new Date()) / 86400000);
        val.textContent = diff < 0 ? `Overdue by ${Math.abs(diff)} days` : `${diff} days left`;
        val.style.color = diff < 0 ? '#ef4444' : (diff <= 3 ? '#fbbf24' : '#3b82f6');
        box.classList.remove('hidden');
    }
}

// ==========================================
// 8. HELPERS & EVENT LISTENERS
// ==========================================

function formatDateStr(d) { return d.toISOString().split('T')[0]; }
function parseDateLocal(s) { const b = s.split('-'); return new Date(b[0], b[1]-1, b[2]); }

function populateAssigneeOptions() {
    const select = document.getElementById('task-assignee');
    // ในหน้า New Task เราบังคับให้เป็นตัวเองอยู่แล้ว 
    // แต่เราใส่ชื่อทุกคนไว้เผื่อต้องการทำฟีเจอร์อื่นในอนาคตได้
    select.innerHTML = users.map(u => `<option value="${u.EmployeeID}">${u.Name}</option>`).join('');
}

function setupEventListeners() {
    // ระบบเปลี่ยนเดือน
    document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); refreshUI(); };
    document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); refreshUI(); };
    document.getElementById('today-btn').onclick = () => { currentDate = new Date(); refreshUI(); };

    // เปิด Modal ใหม่
    document.getElementById('add-task-btn').onclick = () => {
    const today = formatDateStr(new Date());
    
    // 1. ตั้งค่าวันที่เริ่มต้นและสิ้นสุดเป็นวันนี้
    document.getElementById('task-start').value = today;
    document.getElementById('task-end').value = today;
    
    // 2. จัดการเรื่อง Assignee: ให้เป็นของตัวเองเท่านั้น
    const assigneeSelect = document.getElementById('task-assignee');
    
    // ตรวจสอบว่าใน select มีตัวเลือกของตัวเองไหม ถ้าไม่มีให้สร้างขึ้นมา (ป้องกันกรณีข้อมูลยังโหลดไม่เสร็จ)
    assigneeSelect.innerHTML = `<option value="${currentUser.EmployeeID}">${currentUser.Name}</option>`;
    
    // เลือกชื่อตัวเอง
    assigneeSelect.value = currentUser.EmployeeID;
    
    // ล็อกช่องเลือกไว้ (Disabled) เพื่อไม่ให้เปลี่ยนเป็นคนอื่น
    assigneeSelect.disabled = true;

    // 3. เปิด Modal พร้อม Animation
    document.getElementById('task-modal').classList.add('active');
};
    document.getElementById('edit-task-btn').onclick = () => setDetailEditMode(true);
    document.getElementById('cancel-edit-btn').onclick = () => openTaskDetails(currentDetailTask);

    // ปิด Modal
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
    
    // Logout
    document.getElementById('logout-btn').onclick = () => { 
        sessionStorage.clear(); 
        window.location.href = 'login.html'; 
    };
}
