// CampusFlow App JS Engine

// State Management
let assignments = [];
let currentFilter = 'all';
let currentView = 'list'; // 'list' or 'calendar'

// Calendar Date State (Dynamic - based on actual current date)
const _now = new Date();
let calendarYear = _now.getFullYear();
let calendarMonth = _now.getMonth();

// Holiday State
// Map of "YYYY-MM-DD" -> holiday name string
let holidayMap = {};
let holidayApiKey = localStorage.getItem('campusflow_holiday_api_key') || '';
// Track which year-months have already been fetched to avoid duplicate calls
let fetchedHolidayMonths = new Set();

// Mock Data for University Students to populate if local storage is empty
const MOCK_DATA = [
    {
        id: "mock-1",
        title: "컴퓨터 네트워크 기말 팀 프로젝트 발표",
        subject: "컴퓨터네트워크",
        status: "progress",
        dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0]; })(),
        dueTime: "18:00",
        memo: "PPT 발표 대본 수정 및 발표 예행 연습 진행하기. 깃허브 링크 제출 필수.",
        roles: [
            { type: "발표", name: "김철수" },
            { type: "개발", name: "이영희" },
            { type: "자료조사", name: "박민수" }
        ],
        createdAt: Date.now() - 86400000 * 2
    },
    {
        id: "mock-2",
        title: "딥러닝 알고리즘 구현 실습 과제 3",
        subject: "인공지능개론",
        status: "pending",
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: "23:59",
        memo: "CNN 레이어 조정해서 정확도 92% 이상 달성하는 보고서 제출하기.",
        roles: [
            { type: "개인", name: "나(본인)" }
        ],
        createdAt: Date.now() - 86400000
    },
    {
        id: "mock-3",
        title: "소프트웨어 공학 방법론 에세이 작성",
        subject: "소프트웨어공학",
        status: "completed",
        dueDate: (() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().split('T')[0]; })(),
        dueTime: "12:00",
        memo: "애자일 방법론과 폭포수 모델 비교 에세이 A4 3장 분량. 업로드 완료.",
        roles: [],
        createdAt: Date.now() - 86400000 * 4
    }
];

// Load and Initialize Data
function init() {
    const saved = localStorage.getItem('campusflow_assignments');
    if (saved) {
        try {
            assignments = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse saved data", e);
            assignments = [...MOCK_DATA];
        }
    } else {
        assignments = [...MOCK_DATA];
        saveData();
    }
    
    // Bind Event Listeners
    bindEvents();
    bindHolidayApiUI();
    
    // Initial Render
    render();
    
    // Render Icons
    lucide.createIcons();
}

// Save Data to Local Storage
function saveData() {
    localStorage.setItem('campusflow_assignments', JSON.stringify(assignments));
}

// Event Listeners Binding
function bindEvents() {
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const addModal = document.getElementById('addModal');
    const assignmentForm = document.getElementById('assignmentForm');
    const btnAddRoleInput = document.getElementById('btnAddRoleInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const btnEmptyAdd = document.getElementById('btnEmptyAdd');
    
    // View Switch Buttons
    const btnListView = document.getElementById('btnListView');
    const btnCalendarView = document.getElementById('btnCalendarView');
    const assignmentGrid = document.getElementById('assignmentGrid');
    const calendarContainer = document.getElementById('calendarContainer');
    const sortControlWrapper = document.getElementById('sortControlWrapper');

    // Modal Control
    const openModal = () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('taskDueDate').value = today;
        document.getElementById('roleInputsList').innerHTML = '';
        addModal.classList.add('active');
    };
    
    const closeModal = () => {
        addModal.classList.remove('active');
        assignmentForm.reset();
    };

    btnOpenAddModal.addEventListener('click', openModal);
    if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    
    addModal.addEventListener('click', (e) => {
        if (e.target === addModal) closeModal();
    });

    btnAddRoleInput.addEventListener('click', () => {
        addRoleInputRow();
    });

    assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('taskTitle').value.trim();
        const subject = document.getElementById('taskSubject').value.trim();
        const status = document.getElementById('taskStatus').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const dueTime = document.getElementById('taskDueTime').value || "23:59";
        const memo = document.getElementById('taskMemo').value.trim();
        
        const roleRows = document.querySelectorAll('.role-input-row');
        const roles = [];
        roleRows.forEach(row => {
            const type = row.querySelector('.role-input-select').value;
            const name = row.querySelector('.role-input-name').value.trim();
            if (name) {
                roles.push({ type, name });
            }
        });

        const newAssignment = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            title,
            subject,
            status,
            dueDate,
            dueTime,
            memo,
            roles,
            createdAt: Date.now()
        };

        assignments.push(newAssignment);
        saveData();
        closeModal();
        render();
        showToast("새 일정이 성공적으로 등록되었습니다!", "success");
    });

    sortSelect.addEventListener('change', () => {
        render();
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            render();
        });
    });

    btnListView.addEventListener('click', () => {
        currentView = 'list';
        btnListView.classList.add('active');
        btnCalendarView.classList.remove('active');
        assignmentGrid.style.display = 'grid';
        sortControlWrapper.style.display = 'flex';
        calendarContainer.style.display = 'none';
        render();
    });

    btnCalendarView.addEventListener('click', () => {
        currentView = 'calendar';
        btnCalendarView.classList.add('active');
        btnListView.classList.remove('active');
        assignmentGrid.style.display = 'none';
        sortControlWrapper.style.display = 'none';
        calendarContainer.style.display = 'flex';
        render();
    });

    document.getElementById('btnPrevMonth').addEventListener('click', () => {
        calendarMonth--;
        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }
        render();
    });

    document.getElementById('btnNextMonth').addEventListener('click', () => {
        calendarMonth++;
        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }
        render();
    });
}

// Add Dynamic Role Input row in Modal
function addRoleInputRow() {
    const container = document.getElementById('roleInputsList');
    const row = document.createElement('div');
    row.className = 'role-input-row';
    
    row.innerHTML = `
        <select class="form-select role-input-select">
            <option value="역할">역할</option>
            <option value="팀장">팀장</option>
            <option value="개발">개발</option>
            <option value="디자인">디자인</option>
            <option value="자료조사">자료조사</option>
            <option value="발표">발표</option>
            <option value="보고서">보고서</option>
            <option value="개인">개인</option>
        </select>
        <input type="text" class="role-input-name" placeholder="이름 입력 (예: 홍길동)" style="flex-grow: 1;">
        <button type="button" class="icon-btn delete btnRemoveRoleRow">
            <i data-lucide="minus"></i>
        </button>
    `;
    
    container.appendChild(row);
    lucide.createIcons();
    
    row.querySelector('.btnRemoveRoleRow').addEventListener('click', () => {
        row.remove();
    });
}

// Calculate D-Day — always uses actual current date
function calculateDDay(dueDateStr, dueTimeStr) {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(`${dueDateStr}T${dueTimeStr || '23:59'}:00`);
    const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    const diffTime = targetMidnight - todayMidnight;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { text: "기간 만료", class: "done", level: "overdue", days: diffDays };
    } else if (diffDays === 0) {
        return { text: "D-Day", class: "urgent", level: "today", days: 0 };
    } else if (diffDays === 1) {
        return { text: "D-1", class: "urgent", level: "urgent", days: 1 };
    } else if (diffDays <= 3) {
        return { text: `D-${diffDays}`, class: "warning", level: "warning", days: diffDays };
    } else {
        return { text: `D-${diffDays}`, class: "normal", level: "normal", days: diffDays };
    }
}

// Update Dashboard Statistics & Visual Progress Graph
function updateDashboard() {
    const total = assignments.length;
    const pending = assignments.filter(a => a.status === 'pending').length;
    const progress = assignments.filter(a => a.status === 'progress').length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    
    document.getElementById('statTotal').innerText = total;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('statProgress').innerText = progress;
    document.getElementById('statCompleted').innerText = completed;

    let weightSum = 0;
    assignments.forEach(a => {
        if (a.status === 'completed') weightSum += 1.0;
        else if (a.status === 'progress') weightSum += 0.4;
    });
    
    const completionPercent = total > 0 ? Math.round((weightSum / total) * 100) : 0;
    
    const circlePath = document.getElementById('progressCirclePath');
    circlePath.setAttribute('stroke-dasharray', `${completionPercent}, 100`);
    
    document.getElementById('progressPercent').innerText = `${completionPercent}%`;
    document.getElementById('completedCountText').innerText = `${completed}개`;
    document.getElementById('weightText').innerText = `${Math.round(weightSum * 10) / 10} / ${total}`;
    
    document.getElementById('visualProgressBar').style.width = `${completionPercent}%`;
}

// Delete Assignment
window.deleteAssignment = function(id) {
    if (confirm("정말로 이 과제를 삭제하시겠습니까?")) {
        assignments = assignments.filter(a => a.id !== id);
        saveData();
        render();
        showToast("과제가 삭제되었습니다.", "info");
    }
};

// Change Status from Card Select
window.updateStatus = function(id, newStatus) {
    const task = assignments.find(a => a.id === id);
    if (task) {
        task.status = newStatus;
        saveData();
        render();
        showToast(`과제 진행 현황이 업데이트되었습니다.`, "success");
    }
};

// Update Card Memo Value on blur or input
window.updateMemo = function(id, newMemo) {
    const task = assignments.find(a => a.id === id);
    if (task) {
        task.memo = newMemo;
        saveData();
    }
};

// Calendar Event Toast display utility
window.showEventDetail = function(id) {
    const task = assignments.find(a => a.id === id);
    if (task) {
        const statusMap = { pending: '대기중 ⏳', progress: '진행중 ⚙️', completed: '완료됨 🎉' };
        showToast(`[${task.subject}] ${task.title}\n마감: ${task.dueDate} (${task.dueTime})\n상태: ${statusMap[task.status]}`, "info");
    }
};

// Main Rendering Engine
function render() {
    const grid = document.getElementById('assignmentGrid');
    const emptyState = document.getElementById('emptyState');
    const sortVal = document.getElementById('sortSelect').value;
    
    let filtered = assignments.filter(a => {
        if (currentFilter === 'all') return true;
        return a.status === currentFilter;
    });

    if (currentView === 'list') {
        filtered.sort((a, b) => {
            if (sortVal === 'dday') {
                if (a.status === 'completed' && b.status !== 'completed') return 1;
                if (a.status !== 'completed' && b.status === 'completed') return -1;
                
                const dayA = calculateDDay(a.dueDate, a.dueTime).days;
                const dayB = calculateDDay(b.dueDate, b.dueTime).days;
                
                const isOverdueA = dayA < 0;
                const isOverdueB = dayB < 0;
                
                if (isOverdueA && !isOverdueB) return 1;
                if (!isOverdueA && isOverdueB) return -1;
                
                return dayA - dayB;
            } else if (sortVal === 'alphabet') {
                return a.subject.localeCompare(b.subject, 'ko');
            } else if (sortVal === 'created') {
                return b.createdAt - a.createdAt;
            }
            return 0;
        });
        
        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            grid.style.display = 'grid';
            emptyState.style.display = 'none';
            
            grid.innerHTML = '';
            filtered.forEach(task => {
                const dday = calculateDDay(task.dueDate, task.dueTime);
                
                let rolesHtml = '';
                if (task.roles && task.roles.length > 0) {
                    rolesHtml = task.roles.map(r => `
                        <span class="role-tag">
                            <span class="role-tag-type">${r.type}</span>
                            <span class="role-tag-name">${r.name}</span>
                        </span>
                    `).join('');
                } else {
                    rolesHtml = `<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">배분된 역할이 없습니다</span>`;
                }
                
                let cardExtraClass = '';
                if (task.status === 'completed') {
                    cardExtraClass = 'completed-card';
                } else if (dday.level === 'overdue') {
                    cardExtraClass = 'overdue-card';
                }
                
                const card = document.createElement('div');
                card.className = `assignment-card glass-card ${cardExtraClass}`;
                
                card.innerHTML = `
                    <div class="card-header">
                        <div>
                            <span class="subject-badge">${escapeHtml(task.subject)}</span>
                            <h3 class="card-title">${escapeHtml(task.title)}</h3>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn delete" onclick="deleteAssignment('${task.id}')" title="과제 삭제">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="dday-section">
                        <div class="dday-left">
                            <span class="due-date-lbl">마감 기한</span>
                            <span class="due-date-txt">
                                <i data-lucide="calendar" style="width:14px;height:14px;"></i>
                                ${task.dueDate} (${task.dueTime})
                            </span>
                        </div>
                        <span class="dday-badge ${dday.class}">${dday.text}</span>
                    </div>
                    
                    <div class="roles-box">
                        <div class="roles-title">
                            <i data-lucide="users" style="width:14px;height:14px;"></i>
                            <span>역할 및 분담원</span>
                        </div>
                        <div class="roles-list">
                            ${rolesHtml}
                        </div>
                    </div>
                    
                    <div class="card-memo-section">
                        <div class="memo-lbl">
                            <span><i data-lucide="sticky-note" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> 과제 세부 메모</span>
                            <span style="font-size:0.65rem;opacity:0.6;">자동 저장됨</span>
                        </div>
                        <textarea class="card-memo-textarea" rows="2" placeholder="메모를 입력해 주세요..." onblur="updateMemo('${task.id}', this.value)" oninput="updateMemo('${task.id}', this.value)">${escapeHtml(task.memo || '')}</textarea>
                    </div>
                    
                    <div class="card-footer">
                        <span class="status-change-label">진행 상황</span>
                        <select class="card-status-select" onchange="updateStatus('${task.id}', this.value)">
                            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>대기중</option>
                            <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>진행중</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>완료됨</option>
                        </select>
                    </div>
                `;
                
                grid.appendChild(card);
            });
        }
    } else {
        renderCalendar(filtered);
    }
    
    updateDashboard();
    lucide.createIcons();
}

// Monthly Calendar Render Algorithm
function renderCalendar(filteredTasks) {
    const gridBody = document.getElementById('calendarGridBody');
    const monthTitle = document.getElementById('calendarMonthTitle');
    
    monthTitle.innerText = `${calendarYear}년 ${calendarMonth + 1}월`;
    
    gridBody.innerHTML = '';
    
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    
    // Real today
    const realToday = new Date();
    const realTodayYear = realToday.getFullYear();
    const realTodayMonth = realToday.getMonth();
    const realTodayDate = realToday.getDate();
    
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty-day';
        gridBody.appendChild(emptyCell);
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        // Today highlight
        if (calendarYear === realTodayYear && calendarMonth === realTodayMonth && day === realTodayDate) {
            cell.classList.add('today-day');
        }
        
        const mm = String(calendarMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateKey = `${calendarYear}-${mm}-${dd}`;
        
        // Check for public holiday
        const holidayName = holidayMap[dateKey];
        if (holidayName) {
            cell.classList.add('holiday-day');
        }
        
        // Build event tags — holiday first, then user tasks
        let eventsHtml = '';

        if (holidayName) {
            eventsHtml += `<div class="cal-event-tag holiday" title="${escapeHtml(holidayName)}">${escapeHtml(holidayName)}</div>`;
        }

        const dayTasks = filteredTasks.filter(t => t.dueDate === dateKey);
        if (dayTasks.length > 0) {
            eventsHtml += dayTasks.map(t => {
                const label = `[${t.subject}] ${t.title}`;
                return `<div class="cal-event-tag ${t.status}" onclick="showEventDetail('${t.id}')" title="${escapeHtml(label)}">${escapeHtml(label)}</div>`;
            }).join('');
        }
        
        cell.innerHTML = `
            <span class="day-number">${day}</span>
            <div class="cal-event-list">${eventsHtml}</div>
        `;
        
        gridBody.appendChild(cell);
    }

}

// Utility to escape HTML text
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Toast notification trigger
function showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = "info";
    if (type === "success") icon = "check-circle2";
    if (type === "error") icon = "alert-triangle";
    
    toast.innerHTML = `
        <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
        <span style="white-space: pre-line;">${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}


// ─────────────────────────────────────────────
//  공휴일 API (공공데이터포털 한국천문연구원 특일정보)
// ─────────────────────────────────────────────

/**
 * Fetch public holidays for a given year+month from the government API.
 * Uses a CORS proxy because the government endpoint doesn't support CORS.
 * The proxy URL pattern: https://apis.data.go.kr/... → direct fetch works in
 * most modern browsers if the service allows it. If not, falls back gracefully.
 *
 * API docs: https://www.data.go.kr/data/15012690/openapi.do
 * Endpoint: GET /B090041/openapi/service/SpcdeInfoService/getRestDeInfo
 * Params: ServiceKey, solYear, solMonth, _type=json, numOfRows=30
 */
async function fetchHolidaysForMonth(apiKey, year, month) {
    const monthKey = `${year}-${String(month).padStart(2,'0')}`;
    if (fetchedHolidayMonths.has(monthKey)) return;

    const mm = String(month).padStart(2, '0');
    const apiUrl = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
        `?ServiceKey=${encodeURIComponent(apiKey)}` +
        `&solYear=${year}&solMonth=${mm}&_type=json&numOfRows=30`;

    // Try 1: direct call (works when API has CORS headers)
    // Try 2: allorigins proxy (HTTPS-safe, no signup needed)
    // Try 3: corsproxy.io
    const attempts = [
        () => fetch(apiUrl),
        () => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`)
            .then(r => r.json())
            .then(data => {
                // allorigins wraps response in { contents: "..." }
                return new Response(data.contents, { status: 200, headers: { 'Content-Type': 'application/json' } });
            }),
        () => fetch(`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`),
    ];

    let json = null;
    let lastErr = null;

    for (const attempt of attempts) {
        try {
            const res = await attempt();
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            // Government API sometimes returns XML even with _type=json — detect and skip
            if (text.trim().startsWith('<')) {
                // Parse XML response as fallback
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'application/xml');
                const items = doc.querySelectorAll('item');
                if (items.length === 0) {
                    fetchedHolidayMonths.add(monthKey);
                    return;
                }
                items.forEach(item => {
                    const isHoliday = item.querySelector('isHoliday')?.textContent;
                    if (isHoliday === 'Y') {
                        const d = item.querySelector('locdate')?.textContent || '';
                        const name = item.querySelector('dateName')?.textContent || '공휴일';
                        if (d.length === 8) {
                            const dateKey = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
                            holidayMap[dateKey] = name;
                        }
                    }
                });
                fetchedHolidayMonths.add(monthKey);
                localStorage.setItem('campusflow_holidays', JSON.stringify(holidayMap));
                return;
            }
            json = JSON.parse(text);
            break; // success
        } catch (e) {
            lastErr = e;
        }
    }

    if (!json) throw lastErr || new Error('모든 요청 방법 실패');

    const body = json?.response?.body;
    if (!body) throw new Error('응답 형식 오류');

    const items = body.items?.item;
    if (!items) {
        fetchedHolidayMonths.add(monthKey);
        return;
    }

    const list = Array.isArray(items) ? items : [items];
    list.forEach(item => {
        if (item.isHoliday === 'Y') {
            const d = String(item.locdate);
            if (d.length === 8) {
                const dateKey = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
                holidayMap[dateKey] = item.dateName;
            }
        }
    });

    fetchedHolidayMonths.add(monthKey);
    localStorage.setItem('campusflow_holidays', JSON.stringify(holidayMap));
}

async function loadHolidaysForCurrentView() {
    if (!holidayApiKey) return;
    const statusEl = document.getElementById('holidayApiStatus');
    const btn = document.getElementById('btnLoadHolidays');

    if (btn) btn.disabled = true;
    if (statusEl) {
        statusEl.className = 'calendar-api-status';
        statusEl.textContent = '불러오는 중...';
    }

    try {
        const next = new Date(calendarYear, calendarMonth + 1, 1);
        await fetchHolidaysForMonth(holidayApiKey, calendarYear, calendarMonth + 1);
        await fetchHolidaysForMonth(holidayApiKey, next.getFullYear(), next.getMonth() + 1);

        if (statusEl) {
            statusEl.className = 'calendar-api-status ok';
            statusEl.textContent = `✓ 공휴일 ${Object.keys(holidayMap).length}건`;
        }
        // render ONCE — renderCalendar will NOT trigger another fetch
        if (currentView === 'calendar') render();
    } catch (err) {
        if (statusEl) {
            statusEl.className = 'calendar-api-status err';
            statusEl.textContent = `✗ 오류: ${err.message}`;
        }
        console.error('Holiday API error:', err);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function bindHolidayApiUI() {
    const keyInput = document.getElementById('holidayApiKey');
    const btn = document.getElementById('btnLoadHolidays');
    if (!keyInput || !btn) return;

    // Restore saved key
    if (holidayApiKey) {
        keyInput.value = holidayApiKey;
        // Try to restore cached holidays from localStorage
        const cached = localStorage.getItem('campusflow_holidays');
        if (cached) {
            try {
                holidayMap = JSON.parse(cached);
                const statusEl = document.getElementById('holidayApiStatus');
                if (statusEl) {
                    statusEl.className = 'calendar-api-status ok';
                    statusEl.textContent = `✓ 캐시된 공휴일 ${Object.keys(holidayMap).length}건`;
                }
            } catch(e) {}
        }
    }

    keyInput.addEventListener('change', () => {
        holidayApiKey = keyInput.value.trim();
        localStorage.setItem('campusflow_holiday_api_key', holidayApiKey);
        // Reset fetched set so re-fetch is possible with new key
        fetchedHolidayMonths = new Set();
    });

    btn.addEventListener('click', loadHolidaysForCurrentView);
}

// Fire up!
document.addEventListener('DOMContentLoaded', init);
