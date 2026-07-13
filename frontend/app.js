document.addEventListener('DOMContentLoaded', () => {
    const tabOpen = document.getElementById('tab-open');
    const tabClosed = document.getElementById('tab-closed');
    const openSection = document.getElementById('open-positions-section');
    const closedSection = document.getElementById('closed-positions-section');
    const modalNew = document.getElementById('modal-new');
    const modalEdit = document.getElementById('modal-edit');
    const modalGroupEdit = document.getElementById('modal-group-edit');
    const modalGroupClose = document.getElementById('modal-group-close');
    const modalClose = document.getElementById('modal-close');
    const btnNew = document.getElementById('btn-new-position');
    const btnAddLeg = document.getElementById('btn-add-leg');
    const legsContainer = document.getElementById('legs-container');
    const groupLegsContainer = document.getElementById('edit-group-legs-container');
    const groupCloseLegsContainer = document.getElementById('group-close-legs-container');
    const formNew = document.getElementById('form-new');
    const formEdit = document.getElementById('form-edit');
    const formGroupEdit = document.getElementById('form-group-edit');
    const formGroupClose = document.getElementById('form-group-close');
    const formClose = document.getElementById('form-close');
    const closeBtns = document.querySelectorAll('.close');
    const globalExpInput = document.getElementById('new-exp-date');
    const globalQtyInput = document.getElementById('new-qty');
    const globalMultiplierInput = document.getElementById('new-multiplier');
    const searchBox = document.getElementById('search-box');
    const btnClearFilter = document.getElementById('btn-clear-filter');
    const timeframeFilter = document.getElementById('timeframe-filter');

    let currentStatus = 'Open';
    let allPositions = [];
    let sortColumnOpen = 'expiry';
    let sortDirectionOpen = 'asc';
    let sortColumnClosed = 'close_date';
    let sortDirectionClosed = 'desc';

    searchBox.addEventListener('input', () => {
        renderTable(currentStatus, allPositions);
    });

    btnClearFilter.addEventListener('click', () => {
        searchBox.value = '';
        btnClearFilter.style.display = 'none';
        renderTable(currentStatus, allPositions);
    });

    if (timeframeFilter) {
        timeframeFilter.addEventListener('change', () => {
            renderTable(currentStatus, allPositions);
        });
    }

    // Header click listeners for column sorting
    document.querySelectorAll('table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const status = table.id === 'table-open' ? 'Open' : 'Closed';
            const col = th.getAttribute('data-sort');
            
            if (status === 'Open') {
                if (sortColumnOpen === col) {
                    sortDirectionOpen = sortDirectionOpen === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumnOpen = col;
                    sortDirectionOpen = 'asc';
                }
            } else {
                if (sortColumnClosed === col) {
                    sortDirectionClosed = sortDirectionClosed === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumnClosed = col;
                    sortDirectionClosed = 'asc';
                }
            }
            
            renderTable(status, allPositions);
        });
    });

    function formatCurrency(num) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    function getNextFriday() {
        const today = new Date();
        const dayOfWeek = today.getUTCDay(); 
        const diff = (5 - dayOfWeek + 7) % 7;
        const nextFriday = new Date(today);
        nextFriday.setUTCDate(today.getUTCDate() + (diff === 0 ? 7 : diff));
        return nextFriday;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr.split('T')[0];
    }

    function isDateInTimeframe(dateVal, timeframe) {
        if (timeframe === 'all') return true;
        if (!dateVal) return false;
        
        const testDate = new Date(dateVal);
        const now = new Date();
        
        // Start of today (local time)
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (timeframe === 'today') {
            return testDate >= startOfToday;
        }
        if (timeframe === 'week') {
            const day = now.getDay();
            const startOfWeek = new Date(startOfToday.getTime() - day * 24 * 60 * 60 * 1000);
            return testDate >= startOfWeek;
        }
        if (timeframe === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return testDate >= startOfMonth;
        }
        if (timeframe === '30days') {
            const startOf30DaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
            return testDate >= startOf30DaysAgo;
        }
        if (timeframe === 'ytd') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return testDate >= startOfYear;
        }
        return true;
    }



    function updateHeaderSortIndicators(status) {
        const tableId = status === 'Open' ? 'table-open' : 'table-closed';
        const activeCol = status === 'Open' ? sortColumnOpen : sortColumnClosed;
        const activeDir = status === 'Open' ? sortDirectionOpen : sortDirectionClosed;
        
        const headers = document.querySelectorAll(`#${tableId} thead th[data-sort]`);
        headers.forEach(th => {
            let text = th.textContent.replace(/ [▲▼]/g, '');
            const col = th.getAttribute('data-sort');
            if (col === activeCol) {
                text += activeDir === 'asc' ? ' ▲' : ' ▼';
            }
            th.textContent = text;
        });
    }

    // Tab switching
    tabOpen.addEventListener('click', () => {
        tabOpen.classList.add('active');
        tabClosed.classList.remove('active');
        openSection.style.display = 'block';
        closedSection.style.display = 'none';
        currentStatus = 'Open';
        if (timeframeFilter) {
            timeframeFilter.value = 'all'; // Default to all time
        }
        loadPositions('Open');
    });

    tabClosed.addEventListener('click', () => {
        tabClosed.classList.add('active');
        tabOpen.classList.remove('active');
        closedSection.style.display = 'block';
        openSection.style.display = 'none';
        currentStatus = 'Closed';
        loadPositions('Closed');
    });

    // Modal handling
    btnNew.addEventListener('click', () => {
        modalNew.style.display = 'block';
        document.getElementById('new-date').valueAsDate = new Date();
        globalExpInput.valueAsDate = getNextFriday();
        globalMultiplierInput.value = 100;
        legsContainer.innerHTML = '';
        addLegEntry(); 
        calculateMaxLoss(); // Initialize fields
    });

    btnAddLeg.addEventListener('click', () => {
        addLegEntry();
    });

    function formatContractName(expDateStr, strike, cp) {
        if (!expDateStr || !strike || !cp) return '';
        const date = new Date(expDateStr);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const mmm = months[date.getUTCMonth()];
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const yy = String(date.getUTCFullYear()).slice(-2);
        return `${mmm} ${dd} '${yy} ${strike} ${cp}`;
    }

    function calculateMaxLoss() {
        const legs = Array.from(legsContainer.querySelectorAll('.leg-entry'));
        const qty = parseInt(globalQtyInput.value) || 0;
        const multiplier = parseFloat(globalMultiplierInput.value) || 0;
        let totalNetUsd = 0;
        legs.forEach(leg => {
            totalNetUsd += parseFloat(leg.querySelector('.leg-usd').value) || 0;
        });

        let maxLoss = 0;
        let breakeven = 0;

        if (legs.length === 1) {
            const type = legs[0].querySelector('.leg-type').value;
            const cp = legs[0].querySelector('.leg-cp').value;
            const strike = parseFloat(legs[0].querySelector('.leg-strike').value) || 0;
            const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);
            
            if (type === 'STO' && cp === 'Put') {
                maxLoss = Math.abs(strike * multiplier * qty) - totalNetUsd;
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Put') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'STO' && cp === 'Call') {
                maxLoss = 999999;
                breakeven = strike + netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Call') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike + netPremiumPerShare;
            }
        } else if (legs.length === 2) {
            const types = legs.map(l => l.querySelector('.leg-type').value);
            const cp = legs[0].querySelector('.leg-cp').value;
            const strikes = legs.map(l => parseFloat(l.querySelector('.leg-strike').value) || 0);
            const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);
            
            if (types.includes('STO') && types.includes('BTO')) {
                const strikeWidth = Math.abs(strikes[0] - strikes[1]);
                if (totalNetUsd > 0) { // Credit Spread
                    maxLoss = (strikeWidth * multiplier * qty) - totalNetUsd;
                    if (cp === 'Put') {
                        const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                        breakeven = shortStrike - netPremiumPerShare;
                    } else {
                        const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                        breakeven = shortStrike + netPremiumPerShare;
                    }
                } else { // Debit Spread
                    maxLoss = Math.abs(totalNetUsd);
                    if (cp === 'Put') {
                        const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                        breakeven = longStrike - netPremiumPerShare;
                    } else {
                        const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                        breakeven = longStrike + netPremiumPerShare;
                    }
                }
            }
        }
        document.getElementById('new-max-loss').value = formatCurrency(maxLoss);
        document.getElementById('new-breakeven').value = breakeven > 0 ? breakeven.toFixed(2) : '-';
    }

    function updateAllLegs() {
        legsContainer.querySelectorAll('.leg-entry').forEach(div => {
            const strikeInput = div.querySelector('.leg-strike');
            const cpSelect = div.querySelector('.leg-cp');
            const contractInput = div.querySelector('.leg-contract');
            const priceInput = div.querySelector('.leg-price');
            const commInput = div.querySelector('.leg-comm');
            const usdInput = div.querySelector('.leg-usd');
            const typeSelect = div.querySelector('.leg-type');
            
            const expDate = globalExpInput.value;
            const strike = strikeInput.value;
            const cp = cpSelect.value;
            const autoName = formatContractName(expDate, strike, cp);
            if (autoName) contractInput.value = autoName;

            const qty = parseInt(globalQtyInput.value) || 0;
            const multiplier = parseFloat(globalMultiplierInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const comm = parseFloat(commInput.value) || 0;
            const type = typeSelect.value;
            
            let total = qty * price * multiplier;
            if (type === 'BTO' || type === 'BTC') {
                usdInput.value = (-(total + comm)).toFixed(2);
            } else {
                usdInput.value = (total - comm).toFixed(2);
            }
        });
        calculateMaxLoss();
    }

    globalExpInput.addEventListener('input', updateAllLegs);
    globalQtyInput.addEventListener('input', updateAllLegs);
    globalMultiplierInput.addEventListener('input', updateAllLegs);

    document.getElementById('new-symbol').addEventListener('input', (e) => {
        const symbol = e.target.value.toUpperCase().trim();
        if (symbol === 'NQ') {
            globalMultiplierInput.value = 20;
            updateAllLegs();
        } else if (symbol === 'MNQ') {
            globalMultiplierInput.value = 2;
            updateAllLegs();
        } else if (symbol && symbol !== 'NQ' && symbol !== 'MNQ' && globalMultiplierInput.value != 100) {
            // Optional: reset to 100 if user clears NQ/MNQ, but maybe better to leave it?
            // User might be typing something else. Let's only auto-set, don't auto-reset to avoid annoying the user.
            globalMultiplierInput.value = 100;
            updateAllLegs();
        }
    });

    function addLegEntry() {
        const index = legsContainer.children.length;
        const div = document.createElement('div');
        div.className = 'leg-entry';
        
        let defaultCP = 'Put';
        let defaultType = 'STO';

        if (index > 0) {
            const firstLegDiv = legsContainer.children[0];
            defaultCP = firstLegDiv.querySelector('.leg-cp').value;
            const firstType = firstLegDiv.querySelector('.leg-type').value;
            defaultType = firstType === 'STO' ? 'BTO' : 'STO';
        }

        div.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Strike</label>
                    <input type="number" class="leg-strike" step="0.5" required>
                </div>
                <div class="form-group">
                    <label>C/P</label>
                    <select class="leg-cp">
                        <option value="Call" ${defaultCP === 'Call' ? 'selected' : ''}>Call</option>
                        <option value="Put" ${defaultCP === 'Put' ? 'selected' : ''}>Put</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select class="leg-type">
                        <option value="BTO" ${defaultType === 'BTO' ? 'selected' : ''}>BTO</option>
                        <option value="STO" ${defaultType === 'STO' ? 'selected' : ''}>STO</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Option Price</label>
                    <input type="number" class="leg-price" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Comm (USD)</label>
                    <input type="number" class="leg-comm" step="0.01" value="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex: 2;">
                    <label>Contract Name</label>
                    <input type="text" class="leg-contract" required>
                </div>
                <div class="form-group">
                    <label>Total USD</label>
                    <input type="number" class="leg-usd" step="0.01" required>
                </div>
                <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                    <button type="button" class="btn-remove-leg" onclick="this.parentElement.parentElement.parentElement.remove(); calculateMaxLoss();">X</button>
                </div>
            </div>
        `;
        legsContainer.appendChild(div);

        div.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('input', updateAllLegs);
        });
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modalNew.style.display = 'none';
            modalEdit.style.display = 'none';
            modalGroupEdit.style.display = 'none';
            modalGroupClose.style.display = 'none';
            modalClose.style.display = 'none';
        });
    });

    window.onclick = (event) => { /* Disabled auto-close */ };

    async function loadPositions(status) {
        try {
            const response = await fetch(`api/positions?status=${status}`);
            if (!response.ok) throw new Error('API failed');
            const data = await response.json();
            allPositions = data.positions;
            renderTable(status, allPositions);

            if (status === 'Open') {
                const tsEl = document.getElementById('ib-timestamp');
                if (data.metadata && data.metadata.ib_report_datetime) {
                    const formattedTimestamp = new Date(data.metadata.ib_report_datetime + 'Z').toLocaleString('sv-SE', { timeZone: 'Asia/Singapore' }) + ' GMT+8';
                    tsEl.textContent = `(As of: ${formattedTimestamp})`;
                } else {
                    tsEl.textContent = '';
                }
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
            const tbody = document.querySelector(`#table-${status.toLowerCase()} tbody`);
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Error loading data. Check if database needs migration.</td></tr>`;
        }
    }

    function formatExpiryWithDTE(expiryStr) {
        if (!expiryStr) return '-';
        const datePart = expiryStr.split('T')[0];
        
        // Calculate days to expiration
        const todayObj = new Date();
        todayObj.setHours(0,0,0,0);
        
        const expObj = new Date(expiryStr);
        expObj.setHours(0,0,0,0);
        
        const diffMs = expObj - todayObj;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        let dteStr = '';
        if (diffDays === 0) {
            dteStr = '(today)';
        } else if (diffDays > 0) {
            dteStr = `(${diffDays}d)`;
        } else {
            dteStr = '(expired)';
        }
        
        return `
            <div style="font-weight: bold; color: #ffffff; white-space: nowrap;">${datePart}</div>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${dteStr}</div>
        `;
    }

    function formatMaxLossAndAR(maxLoss, cashRequired) {
        const lossDisplay = maxLoss > 0 ? `<div style="font-weight: bold; color: var(--danger-color);">${formatCurrency(maxLoss)}</div>` : `<div style="color: #94a3b8;">-</div>`;
        const arDisplay = cashRequired > 0 ? `<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${formatCurrency(cashRequired)}</div>` : '';
        return `${lossDisplay}${arDisplay}`;
    }

    function calculateHoldTime(dateOpenedStr, dateClosedStr) {
        if (!dateOpenedStr || !dateClosedStr) return '-';
        const opened = new Date(dateOpenedStr);
        opened.setHours(0,0,0,0);
        
        const closed = new Date(dateClosedStr);
        closed.setHours(0,0,0,0);
        
        const diffMs = closed - opened;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 ? `${diffDays}d` : '-';
    }

    function renderTable(status, positions) {
        const tbody = document.querySelector(`#table-${status.toLowerCase()} tbody`);
        tbody.innerHTML = '';

        const searchValue = searchBox.value.toLowerCase().trim();
        
        let filteredPositions = positions;

        if (searchValue) {
            filteredPositions = filteredPositions.filter(p => 
                p.symbol.toLowerCase().includes(searchValue) || 
                p.group_id.toLowerCase().includes(searchValue)
            );
            btnClearFilter.style.display = 'block';
        } else {
            btnClearFilter.style.display = 'none';
        }

        let totalUsd = 0;
        let totalRisk = 0;
        let totalAR = 0;
        let totalIbUnrealized = 0;
        let anyIbData = false;

        const groups = {};
        filteredPositions.forEach(pos => {
            if (!groups[pos.group_id]) groups[pos.group_id] = [];
            groups[pos.group_id].push(pos);
        });

        let groupList = Object.values(groups);

        // Apply Timeframe Filter
        const timeframeValue = timeframeFilter ? timeframeFilter.value : 'all';
        if (timeframeValue !== 'all') {
            groupList = groupList.filter(group => {
                if (status === 'Open') {
                    return isDateInTimeframe(group[0].date_opened, timeframeValue);
                } else {
                    const dates = group.flatMap(p => p.transactions)
                        .filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC')
                        .map(t => new Date(t.date).getTime());
                    const latestCloseTime = dates.length > 0 ? Math.max(...dates) : 0;
                    return latestCloseTime > 0 && isDateInTimeframe(latestCloseTime, timeframeValue);
                }
            });
        }

        // Apply Column Sorting
        groupList.sort((a, b) => {
            let comparison = 0;
            if (status === 'Open') {
                if (sortColumnOpen === 'symbol') {
                    comparison = a[0].symbol.localeCompare(b[0].symbol);
                } else if (sortColumnOpen === 'expiry') {
                    const dateA = a[0].expiration_date ? new Date(a[0].expiration_date) : new Date(0);
                    const dateB = b[0].expiration_date ? new Date(b[0].expiration_date) : new Date(0);
                    comparison = dateA - dateB;
                } else if (sortColumnOpen === 'max_loss') {
                    const lossA = a[0].max_loss || 0;
                    const lossB = b[0].max_loss || 0;
                    comparison = lossA - lossB;
                } else if (sortColumnOpen === 'pnl') {
                    const valA = a.reduce((sum, p) => sum + p.total_cost_usd, 0);
                    const valB = b.reduce((sum, p) => sum + p.total_cost_usd, 0);
                    comparison = valA - valB;
                }
                return sortDirectionOpen === 'asc' ? comparison : -comparison;
            } else {
                if (sortColumnClosed === 'symbol') {
                    comparison = a[0].symbol.localeCompare(b[0].symbol);
                } else if (sortColumnClosed === 'hold_time') {
                    const getHoldTimeDays = (g) => {
                        const firstPos = g[0];
                        const closeTransDates = g.flatMap(p => p.transactions)
                            .filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC')
                            .map(t => new Date(t.date).getTime());
                        if (closeTransDates.length === 0 || !firstPos.date_opened) return 0;
                        return Math.max(...closeTransDates) - new Date(firstPos.date_opened).getTime();
                    };
                    comparison = getHoldTimeDays(a) - getHoldTimeDays(b);
                } else if (sortColumnClosed === 'pnl') {
                    const valA = a.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                    const valB = b.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                    comparison = valA - valB;
                } else { // default: close_date
                    const getLatestCloseDate = (g) => {
                        const dates = g.flatMap(p => p.transactions)
                            .filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC')
                            .map(t => new Date(t.date).getTime());
                        return dates.length > 0 ? Math.max(...dates) : 0;
                    };
                    comparison = getLatestCloseDate(a) - getLatestCloseDate(b);
                }
                return sortDirectionClosed === 'asc' ? comparison : -comparison;
            }
        });

        // Update sort indicators on headers
        updateHeaderSortIndicators(status);

        if (status === 'Open') {
            groupList.forEach(group => {
                const firstPos = group[0];
                const isSpread = group.length > 1;
                
                // Accumulate total risk (max loss) for footer
                totalRisk += firstPos.max_loss || 0;

                // Calculate group total cost / premium (Potential Return)
                let groupTotalValue = group.reduce((sum, p) => sum + p.total_cost_usd, 0);
                totalUsd += groupTotalValue;

                // Calculate Cash Required (AR Collateral) for the group
                const groupCashRequired = group.reduce((sum, p) => {
                    if (p.initial_type === 'STO' && p.call_put === 'Put') {
                        return sum + (p.strike_price * p.multiplier * p.current_quantity);
                    }
                    return sum;
                }, 0);
                totalAR += groupCashRequired;

                // Calculate Group IB Unrealized P/L
                const groupIbUnrealized = group.reduce((sum, p) => sum + (p.ib_unrealized_profits || 0), 0);
                const groupHasIbData = group.some(p => p.ib_unrealized_profits !== null && p.ib_unrealized_profits !== undefined);

                if (groupHasIbData) {
                    totalIbUnrealized += groupIbUnrealized;
                    anyIbData = true;
                }

                // Create Main Row
                const tr = document.createElement('tr');
                
                // 1. Column: Underlying (Symbol)
                const underlyingLink = `
                    <a href="details?group_id=${firstPos.group_id}" target="_blank" class="symbol-link-v2" title="View Full Details">${firstPos.symbol}</a>
                    <span class="price-val" data-symbol="${firstPos.symbol}" style="font-size: 0.85rem; color: #94a3b8; font-weight: normal; margin-left: 8px;">Loading...</span>
                `;
                
                // 2. Column: Strategy Legs
                let legsHtml = '';
                group.forEach(pos => {
                    const legInitialQty = pos.transactions
                        .filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO')
                        .reduce((sum, t) => sum + t.quantity, 0);
                    const qtyDisplay = pos.current_quantity < legInitialQty ? `${pos.current_quantity} / ${legInitialQty}` : pos.current_quantity;
                    
                    const typeClass = pos.initial_type === 'STO' ? 'leg-type-sto' : 'leg-type-bto';
                    const dateOpenedStr = formatDate(pos.date_opened);
                    
                    let ibLegInfoHtml = '';
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        const ibPnl = pos.ib_unrealized_profits !== null ? pos.ib_unrealized_profits : 0;
                        const pnlClass = ibPnl >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                        const pnlSign = ibPnl > 0 ? '+' : '';
                        ibLegInfoHtml = `
                            <span class="leg-date mobile-only-inline" style="color: #64748b;">|</span>
                            <span class="leg-ib-inline mobile-only-inline" style="font-size: 0.85rem; color: #94a3b8; font-family: monospace;">
                                IB Cur: <span style="color: #ffffff;">${formatCurrency(pos.ib_current_price)}</span> (P/L: <span class="${pnlClass}">${pnlSign}${formatCurrency(ibPnl)}</span>)
                            </span>
                        `;
                    }
                    
                    let mobileRiskStatusHtml = '';
                    if (pos.strike_price !== null) {
                        mobileRiskStatusHtml = `
                            <span class="leg-date mobile-only-inline" style="color: #64748b;">|</span>
                            <span class="risk-status mobile-only-inline" data-symbol="${pos.symbol}" data-strike="${pos.strike_price}" data-cp="${pos.call_put}" style="font-size: 0.85rem; font-family: monospace; font-weight: bold;">Loading...</span>
                        `;
                    }
                    
                    const occ = pos.occ_symbol || '';
                    legsHtml += `
                        <div style="margin-bottom: 6px;">
                            <div class="strategy-leg-item">
                                <span class="${typeClass}">[${pos.initial_type}]</span>
                                <span class="leg-qty">${qtyDisplay} x</span>
                                <span class="leg-contract-name" title="OCC Symbol: ${occ}">${pos.contract_name}</span>
                                <span class="leg-date">(${dateOpenedStr})</span>
                                ${ibLegInfoHtml}
                                ${mobileRiskStatusHtml}
                            </div>
                        </div>
                    `;
                });
                legsHtml = `<div class="legs-wrapper">${legsHtml}</div>`;
                
                // 3. Column: Expiry & DTE
                const expiryHtml = formatExpiryWithDTE(firstPos.expiration_date);
                
                // 4. Column: Price (Open/Cur)
                let groupOpenPriceVal = 0;
                let groupCurrentPriceVal = 0;
                let hasCurrentPrice = false;

                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const openPrice = openTrans ? openTrans.option_price : 0;
                    const sign = pos.initial_type === 'STO' ? 1 : -1;
                    
                    groupOpenPriceVal += openPrice * sign;
                    
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        groupCurrentPriceVal += pos.ib_current_price * sign;
                        hasCurrentPrice = true;
                    }
                });

                const openPriceText = formatCurrency(Math.abs(groupOpenPriceVal));
                const currentPriceText = hasCurrentPrice ? formatCurrency(Math.abs(groupCurrentPriceVal)) : '-';

                const priceHtml = `
                    <div style="font-weight: bold; color: #ffffff;">
                        Open: ${openPriceText}
                    </div>
                    <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
                        Cur: ${currentPriceText}
                    </div>
                `;
                
                // 5. Column: Max Loss & AR Collateral
                const maxLossHtml = formatMaxLossAndAR(firstPos.max_loss || 0, groupCashRequired);
                
                // 6. Column: Potential Return & ROI (and stacked IB Group P/L with percentage)
                const maxLossVal = firstPos.max_loss || 0;
                const roi = maxLossVal > 0 ? ((Math.abs(groupTotalValue) / maxLossVal) * 100).toFixed(2) : null;
                const roiDisplay = roi ? ` <span class="roi-percent">(${roi}%)</span>` : '';
                const potentialReturnClass = groupTotalValue >= 0 ? 'pnl-positive' : 'pnl-negative';
                
                let groupIbPnLHtml = '';
                if (groupHasIbData) {
                    const groupPnLClass = groupIbUnrealized >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                    const groupPnLSign = groupIbUnrealized > 0 ? '+' : '';
                    
                    // Calculate unrealized P/L percentage against max potential returns (net initial premium)
                    const ibPnlPercentVal = Math.abs(groupTotalValue) > 0 
                        ? (groupIbUnrealized / Math.abs(groupTotalValue)) * 100 
                        : 0;
                    const ibPnlPercentDisplay = ibPnlPercentVal !== 0 
                        ? ` (${ibPnlPercentVal > 0 ? '+' : ''}${ibPnlPercentVal.toFixed(2)}%)` 
                        : '';

                    groupIbPnLHtml = `
                        <div style="font-size: 0.8rem; margin-top: 4px; color: #94a3b8; font-weight: normal;">
                            IB P/L: <span class="${groupPnLClass}">${groupPnLSign}${formatCurrency(groupIbUnrealized)}${ibPnlPercentDisplay}</span>
                        </div>
                    `;
                }
                
                const potentialReturnHtml = `
                    <div style="font-weight: bold;">
                        <span class="${potentialReturnClass}">${formatCurrency(groupTotalValue)}</span>${roiDisplay}
                    </div>
                    ${groupIbPnLHtml}
                `;
                
                // 7. Column: Actions
                let actionsHtml = '';
                if (isSpread) {
                    actionsHtml = `
                        <button class="btn-icon" title="View Details" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-icon" title="Edit Group" onclick="openGroupEditModal('${firstPos.group_id}')">✏️</button>
                        <button class="btn-icon" title="Close Group" onclick="openGroupCloseModal('${firstPos.group_id}')">✅</button>
                        <button class="btn-icon" title="Delete Group" onclick="deleteGroup('${firstPos.group_id}')">❌</button>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn-icon" title="View Details" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-icon" title="Edit Position" onclick="openEditModal(${firstPos.id})">✏️</button>
                        <button class="btn-icon" title="Close Position" onclick="openCloseModal(${firstPos.id}, '${firstPos.initial_type}', ${firstPos.current_quantity})">✅</button>
                        <button class="btn-icon" title="Delete Position" onclick="deletePosition(${firstPos.id})">❌</button>
                    `;
                }
                
                tr.innerHTML = `
                    <td class="cell-legs" data-label="Position">
                        <div class="position-underlying-header">${underlyingLink}</div>
                        ${legsHtml}
                    </td>
                    <td class="cell-expiry" data-label="Expiry">${expiryHtml}</td>
                    <td class="cell-price" data-label="Price (Open/Cur)" style="vertical-align: middle;">${priceHtml}</td>
                    <td class="cell-maxloss" data-label="Max Loss / AR">${maxLossHtml}</td>
                    <td class="cell-return" data-label="Premium / P/L">${potentialReturnHtml}</td>
                    <td class="action-cell" data-label="Actions"><div class="action-cell-inner">${actionsHtml}</div></td>
                `;
                
                tbody.appendChild(tr);
                
                // Create Details Row for the entire group
                const detailsTr = document.createElement('tr');
                detailsTr.className = `details-row pos-details-${firstPos.group_id}`;
                detailsTr.style.display = 'none';
                
                let detailsLegsHtml = '';
                group.forEach(pos => {
                    const legCashRequired = (pos.initial_type === 'STO' && pos.call_put === 'Put') 
                        ? (pos.strike_price * pos.multiplier * pos.current_quantity) 
                        : null;
                    
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const openPrice = openTrans ? formatCurrency(openTrans.option_price) : '-';

                    let legIbDetailsHtml = '';
                    if (pos.ib_current_price !== null && pos.ib_current_price !== undefined) {
                        const legPnLVal = pos.ib_unrealized_profits || 0;
                        const legPnLClass = legPnLVal >= 0 ? 'pnl-positive' : 'pnl-negative';
                        const legPnLSign = legPnLVal > 0 ? '+' : '';
                        legIbDetailsHtml = `
                            <div style="flex: 1;">
                                <span style="color: #94a3b8;">IB Price:</span>
                                <span style="color: #ffffff;">${formatCurrency(pos.ib_current_price)}</span>
                            </div>
                            <div style="flex: 1;">
                                <span style="color: #94a3b8;">IB Unrealized P/L:</span>
                                <span class="${legPnLClass}" style="font-weight: bold;">${legPnLSign}${formatCurrency(legPnLVal)}</span>
                            </div>
                        `;
                    }
                    
                    const occ = pos.occ_symbol || '';
                    detailsLegsHtml += `
                        <div class="drawer-leg-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                            <div style="font-weight: bold; color: #ffffff; margin-bottom: 4px;">
                                ${pos.initial_type} ${pos.current_quantity}x ${pos.contract_name}
                                <span style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-left: 10px;">(${occ})</span>
                            </div>
                            <div style="display: flex; gap: 20px; font-size: 0.9rem;">
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Assignment Status:</span>
                                    <span class="risk-status" data-symbol="${pos.symbol}" data-strike="${pos.strike_price}" data-cp="${pos.call_put}">Loading...</span>
                                </div>
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Cash Required:</span>
                                    <span style="color: #ffffff;">${legCashRequired ? formatCurrency(legCashRequired) : '-'}</span>
                                </div>
                                <div style="flex: 1;">
                                    <span style="color: #94a3b8;">Open Price:</span>
                                    <span style="color: #ffffff;">${openPrice}</span>
                                </div>
                                ${legIbDetailsHtml}
                            </div>
                        </div>
                    `;
                });
                
                detailsTr.innerHTML = `
                    <td colspan="6">
                        <div class="details-content-v2" style="background: rgba(255, 255, 255, 0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin: 5px 0;">
                            <div style="margin-bottom: 10px; font-weight: bold;">
                                Current Underlying Price: 
                                <span class="price-val" data-symbol="${firstPos.symbol}">Loading...</span>
                            </div>
                            <div class="drawer-legs-container">
                                ${detailsLegsHtml}
                            </div>
                        </div>
                    </td>
                `;
                
                tbody.appendChild(detailsTr);
            });
            
            // Footer update (moved inside since totalAR is scoped here)
            const riskFooter = document.getElementById('total-open-risk');
            riskFooter.innerHTML = `
                <div style="color: var(--danger-color); font-weight: bold;">${formatCurrency(totalRisk)}</div>
                <div style="font-size: 0.8rem; color: #94a3b8; font-weight: normal; margin-top: 2px;">
                    ${formatCurrency(totalAR)}
                </div>
            `;
        } else {
            groupList.forEach(group => {
                const firstPos = group[0];
                const isSpread = group.length > 1;
                
                let groupTotalValue = group.reduce((sum, p) => sum + p.realized_pnl_usd, 0);
                totalUsd += groupTotalValue;

                // Create Main Row
                const tr = document.createElement('tr');
                
                // 1. Column: Underlying (Symbol)
                const underlyingLink = `<a href="details?group_id=${firstPos.group_id}" target="_blank" class="symbol-link-v2" title="View Full Details">${firstPos.symbol}</a>`;
                
                // 2. Column: Strategy Legs
                let legsHtml = '';
                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const closeTrans = pos.transactions.filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC').pop();
                    const closeType = closeTrans ? closeTrans.transaction_type : (pos.initial_type === 'STO' ? 'BTC' : 'STC');
                    
                    const typeClass = closeType === 'BTC' ? 'leg-type-btc' : 'leg-type-stc';
                    const dateOpened = formatDate(pos.date_opened);
                    const dateClosed = closeTrans ? formatDate(closeTrans.date) : '-';
                    
                    const occ = pos.occ_symbol || '';
                    legsHtml += `
                        <div class="strategy-leg-item">
                            <span class="${typeClass}">[${closeType}]</span>
                            <span class="leg-contract-name" style="color: #38bdf8; font-weight: 500;" title="OCC Symbol: ${occ}">${pos.contract_name}</span>
                            <span class="leg-date-range">(${dateOpened} to ${dateClosed})</span>
                        </div>
                    `;
                });
                legsHtml = `<div class="legs-wrapper">${legsHtml}</div>`;
                
                // 3. Column: Hold Time
                const closeTransDates = group.flatMap(p => p.transactions)
                    .filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC')
                    .map(t => new Date(t.date));
                const latestCloseDate = closeTransDates.length > 0 ? new Date(Math.max(...closeTransDates)) : null;
                const holdTimeStr = (latestCloseDate && firstPos.date_opened) 
                    ? calculateHoldTime(firstPos.date_opened, latestCloseDate.toISOString()) 
                    : '-';
                
                // 4. Column: Realized P/L
                const sign = groupTotalValue > 0 ? '+' : '';
                const pnlClass = groupTotalValue > 0 ? 'pnl-positive' : (groupTotalValue < 0 ? 'pnl-negative' : '');
                const realizedPnLHtml = `<span class="${pnlClass}" style="font-weight: bold;">${sign}${formatCurrency(groupTotalValue)}</span>`;
                
                // 5. Column: Actions
                let actionsHtml = '';
                if (isSpread) {
                    actionsHtml = `
                        <button class="btn-icon" title="View Details" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-icon" title="Edit Group" onclick="openGroupEditModal('${firstPos.group_id}')">✏️</button>
                        <button class="btn-icon" title="Delete Group" onclick="deleteGroup('${firstPos.group_id}')">❌</button>
                    `;
                } else {
                    actionsHtml = `
                        <button class="btn-icon" title="View Details" onclick="toggleDetails(this, '${firstPos.group_id}')">ℹ️</button>
                        <button class="btn-icon" title="Edit Position" onclick="openEditModal(${firstPos.id})">✏️</button>
                        <button class="btn-icon" title="Delete Position" onclick="deletePosition(${firstPos.id})">❌</button>
                    `;
                }
                
                tr.innerHTML = `
                    <td class="cell-legs" data-label="Position">
                        <div class="position-underlying-header">${underlyingLink}</div>
                        ${legsHtml}
                    </td>
                    <td data-label="Hold Time" style="vertical-align: middle; font-weight: bold; color: #ffffff;">${holdTimeStr}</td>
                    <td data-label="Realized P/L" style="vertical-align: middle;">${realizedPnLHtml}</td>
                    <td class="action-cell" data-label="Actions"><div class="action-cell-inner">${actionsHtml}</div></td>
                `;
                
                tbody.appendChild(tr);
                
                // Create details drawer row spanning 5 columns
                const detailsTr = document.createElement('tr');
                detailsTr.className = `details-row pos-details-${firstPos.group_id}`;
                detailsTr.style.display = 'none';
                
                let detailsLegsHtml = '';
                group.forEach(pos => {
                    const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
                    const closeTrans = pos.transactions.filter(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC').pop();
                    
                    const openPrice = openTrans ? formatCurrency(openTrans.option_price) : '-';
                    const closePrice = closeTrans ? formatCurrency(closeTrans.option_price) : '-';
                    const openComm = openTrans ? formatCurrency(openTrans.commission) : '0.00';
                    const closeComm = closeTrans ? formatCurrency(closeTrans.commission) : '0.00';
                    
                    const occ = pos.occ_symbol || '';
                    detailsLegsHtml += `
                        <div class="drawer-leg-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                            <div style="font-weight: bold; color: #ffffff; margin-bottom: 4px;">
                                ${pos.initial_type} ${pos.current_quantity}x ${pos.contract_name}
                                <span style="font-size: 0.8rem; font-family: monospace; color: #64748b; margin-left: 10px;">(${occ})</span>
                            </div>
                            <div style="display: flex; gap: 20px; font-size: 0.9rem;">
                                <div>
                                    <span style="color: #94a3b8;">Open Price:</span>
                                    <span style="color: #ffffff;">${openPrice} (Comm: ${openComm})</span>
                                </div>
                                <div>
                                    <span style="color: #94a3b8;">Close Price:</span>
                                    <span style="color: #ffffff;">${closePrice} (Comm: ${closeComm})</span>
                                </div>
                                <div>
                                    <span style="color: #94a3b8;">Realized P/L:</span>
                                    <span class="${pos.realized_pnl_usd >= 0 ? 'pnl-positive' : 'pnl-negative'}" style="font-weight: bold;">
                                        ${pos.realized_pnl_usd >= 0 ? '+' : ''}${formatCurrency(pos.realized_pnl_usd)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                detailsTr.innerHTML = `
                    <td colspan="4">
                        <div class="details-content-v2" style="background: rgba(255, 255, 255, 0.02); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin: 5px 0;">
                            <div class="drawer-legs-container">
                                ${detailsLegsHtml}
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(detailsTr);
            });
        }

        if (status === 'Open') {
            const usdFooter = document.getElementById('total-open-usd');
            let ibTotalHtml = '';
            if (anyIbData) {
                const totalIbClass = totalIbUnrealized >= 0 ? 'ib-pnl-pos' : 'ib-pnl-neg';
                const totalIbSign = totalIbUnrealized > 0 ? '+' : '';
                
                const totalIbPercent = Math.abs(totalUsd) > 0 ? (totalIbUnrealized / Math.abs(totalUsd)) * 100 : 0;
                const totalIbPercentDisplay = totalIbPercent !== 0 
                    ? ` (${totalIbPercent > 0 ? '+' : ''}${totalIbPercent.toFixed(2)}%)` 
                    : '';
                
                ibTotalHtml = `
                    <div style="font-size: 0.8rem; font-weight: normal; margin-top: 2px;">
                        IB P/L: <span class="${totalIbClass}">${totalIbSign}${formatCurrency(totalIbUnrealized)}${totalIbPercentDisplay}</span>
                    </div>
                `;
            }
            
            usdFooter.innerHTML = `
                <div class="${totalUsd >= 0 ? 'pnl-positive' : 'pnl-negative'}" style="font-weight: bold;">
                    ${formatCurrency(totalUsd)}
                </div>
                ${ibTotalHtml}
            `;
            
            fetchCurrentPrices();
        } else {
            const usdFooter = document.getElementById('total-closed-usd');
            usdFooter.textContent = formatCurrency(totalUsd);
            usdFooter.className = totalUsd >= 0 ? 'pnl-positive' : 'pnl-negative';
        }
    }

    // Global toggle event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-icon')) {
            const targetClass = e.target.getAttribute('data-target');
            const targetRows = document.querySelectorAll(`.${targetClass}`);
            const isHidden = targetRows[0].style.display === 'none';
            
            targetRows.forEach(row => {
                row.style.display = isHidden ? 'table-row' : 'none';
            });
            e.target.textContent = isHidden ? '[-]' : '[+]';
        }
    });

    formNew.addEventListener('submit', async (e) => {
        e.preventDefault();
        const legs = [];
        legsContainer.querySelectorAll('.leg-entry').forEach(div => {
            legs.push({
                contract_name: div.querySelector('.leg-contract').value,
                strike_price: parseFloat(div.querySelector('.leg-strike').value),
                call_put: div.querySelector('.leg-cp').value,
                transaction_type: div.querySelector('.leg-type').value,
                option_price: parseFloat(div.querySelector('.leg-price').value),
                commission: parseFloat(div.querySelector('.leg-comm').value),
                total_usd: parseFloat(div.querySelector('.leg-usd').value)
            });
        });

        const maxLossStr = document.getElementById('new-max-loss').value.replace(/,/g, '');
        const data = {
            symbol: document.getElementById('new-symbol').value,
            date_opened: document.getElementById('new-date').value + "T00:00:00",
            expiration_date: globalExpInput.value + "T00:00:00",
            quantity: parseInt(globalQtyInput.value),
            multiplier: parseFloat(globalMultiplierInput.value) || 100,
            max_loss: parseFloat(maxLossStr) || 0,
            legs: legs
        };

        const response = await fetch('api/positions/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            modalNew.style.display = 'none';
            formNew.reset();
            loadPositions('Open');
        }
    });

    function calculateEditMaxLoss() {
        const type = document.getElementById('edit-type').value;
        const cp = document.getElementById('edit-cp').value;
        const strike = parseFloat(document.getElementById('edit-strike').value) || 0;
        const multiplier = parseFloat(document.getElementById('edit-multiplier').value) || 100;
        
        let netQty = 0;
        let initialQty = 0;
        let openingTotalUsd = 0;
        let grandTotal = 0;
        
        document.querySelectorAll('.transaction-edit-row').forEach(row => {
            const tType = row.querySelector('.trans-type').value;
            const tQty = parseInt(row.querySelector('.trans-qty').value) || 0;
            const tUsd = parseFloat(row.querySelector('.trans-usd').value) || 0;
            
            grandTotal += tUsd;
            
            if (tType === 'BTO' || tType === 'STO') {
                netQty += tQty;
                initialQty += tQty;
                openingTotalUsd += tUsd;
            } else {
                netQty -= tQty;
            }
        });
        
        document.getElementById('edit-qty').value = netQty;
        document.getElementById('edit-total-usd').value = formatCurrency(grandTotal);

        let maxLoss = 0;
        let breakeven = 0;
        const netPremiumPerShare = Math.abs(openingTotalUsd / multiplier / initialQty);

        if (initialQty <= 0) {
            maxLoss = 0;
        } else if (type === 'STO' && cp === 'Put') {
            maxLoss = Math.max(0, (strike * multiplier * initialQty) - openingTotalUsd);
            breakeven = strike - netPremiumPerShare;
        } else if (type === 'BTO' && cp === 'Put') {
            maxLoss = Math.max(0, -openingTotalUsd);
            breakeven = strike - netPremiumPerShare;
        } else if (type === 'STO' && cp === 'Call') {
            maxLoss = 999999;
            breakeven = strike + netPremiumPerShare;
        } else if (type === 'BTO' && cp === 'Call') {
            maxLoss = Math.max(0, -openingTotalUsd);
            breakeven = strike + netPremiumPerShare;
        }
        
        document.getElementById('edit-max-loss').value = formatCurrency(maxLoss);
        document.getElementById('edit-breakeven').value = breakeven > 0 ? breakeven.toFixed(2) : '-';
    }

    window.openEditModal = async (id) => {
        const response = await fetch(`api/positions/${id}`);
        if (!response.ok) return;
        const pos = await response.json();
        
        const idx = allPositions.findIndex(p => p.id === id);
        if (idx !== -1) allPositions[idx] = pos;

        document.getElementById('edit-pos-id').value = pos.id;
        document.getElementById('edit-symbol').value = pos.symbol;
        document.getElementById('edit-date').value = pos.date_opened.split('T')[0];
        document.getElementById('edit-exp-date').value = pos.expiration_date ? pos.expiration_date.split('T')[0] : '';
        document.getElementById('edit-qty').value = pos.current_quantity;
        document.getElementById('edit-multiplier').value = pos.multiplier;
        document.getElementById('edit-contract').value = pos.contract_name;
        document.getElementById('edit-strike').value = pos.strike_price || 0;
        document.getElementById('edit-cp').value = pos.call_put || 'Put';
        document.getElementById('edit-type').value = pos.initial_type;
        document.getElementById('edit-total-usd').value = formatCurrency(pos.total_cost_usd);
        document.getElementById('edit-max-loss').value = pos.max_loss ? formatCurrency(pos.max_loss) : '0.00';
        // We'll call calculateEditMaxLoss which will populate breakeven
        
        const transContainer = document.getElementById('edit-transactions-container');
        transContainer.innerHTML = '';
        pos.transactions.forEach(t => {
            const div = document.createElement('div');
            div.className = 'leg-entry transaction-edit-row';
            div.dataset.transId = t.id;
            div.innerHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" class="trans-date" value="${t.date.split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select class="trans-type">
                            <option value="BTO" ${t.transaction_type === 'BTO' ? 'selected' : ''}>BTO</option>
                            <option value="STO" ${t.transaction_type === 'STO' ? 'selected' : ''}>STO</option>
                            <option value="BTC" ${t.transaction_type === 'BTC' ? 'selected' : ''}>BTC</option>
                            <option value="STC" ${t.transaction_type === 'STC' ? 'selected' : ''}>STC</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Qty</label>
                        <input type="number" class="trans-qty" value="${t.quantity}" min="1" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Price</label>
                        <input type="number" class="trans-price" step="0.01" value="${t.option_price}" required>
                    </div>
                    <div class="form-group">
                        <label>Comm</label>
                        <input type="number" class="trans-comm" step="0.01" value="${t.commission}">
                    </div>
                    <div class="form-group">
                        <label>Total USD</label>
                        <input type="number" class="trans-usd" step="0.01" value="${t.total_usd}">
                    </div>
                </div>
            `;
            transContainer.appendChild(div);
            
            div.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', () => {
                    const qty = parseInt(div.querySelector('.trans-qty').value) || 0;
                    const price = parseFloat(div.querySelector('.trans-price').value) || 0;
                    const comm = parseFloat(div.querySelector('.trans-comm').value) || 0;
                    const type = div.querySelector('.trans-type').value;
                    const currentMultiplier = parseFloat(document.getElementById('edit-multiplier').value) || 100;
                    let total = qty * price * currentMultiplier;
                    if (type === 'BTO' || type === 'BTC') {
                        div.querySelector('.trans-usd').value = (-(total + comm)).toFixed(2);
                    } else {
                        div.querySelector('.trans-usd').value = (total - comm).toFixed(2);
                    }

                    let grandTotal = 0;
                    document.querySelectorAll('.transaction-edit-row .trans-usd').forEach(input => {
                        grandTotal += parseFloat(input.value) || 0;
                    });
                    document.getElementById('edit-total-usd').value = formatCurrency(grandTotal);
                    calculateEditMaxLoss();
                });
            });
        });

        calculateEditMaxLoss(); // Ensure breakeven is populated on load
        modalEdit.style.display = 'block';
    };

    ['edit-qty', 'edit-strike', 'edit-cp', 'edit-type', 'edit-multiplier'].forEach(id => {
        document.getElementById(id).addEventListener('input', calculateEditMaxLoss);
    });

    formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-pos-id').value;

        const transRows = document.querySelectorAll('.transaction-edit-row');
        for (const row of transRows) {
            const transId = row.dataset.transId;
            const transData = {
                date: row.querySelector('.trans-date').value + "T00:00:00",
                transaction_type: row.querySelector('.trans-type').value,
                quantity: parseInt(row.querySelector('.trans-qty').value),
                option_price: parseFloat(row.querySelector('.trans-price').value),
                commission: parseFloat(row.querySelector('.leg-comm') ? row.querySelector('.leg-comm').value : (row.querySelector('.trans-comm') ? row.querySelector('.trans-comm').value : 0)),
                total_usd: parseFloat(row.querySelector('.trans-usd').value)
            };
            await fetch(`api/transactions/${transId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transData)
            });
        }

        const maxLossStr = document.getElementById('edit-max-loss').value.replace(/,/g, '');
        const posData = {
            symbol: document.getElementById('edit-symbol').value,
            date_opened: document.getElementById('edit-date').value + "T00:00:00",
            expiration_date: document.getElementById('edit-exp-date').value + "T00:00:00",
            contract_name: document.getElementById('edit-contract').value,
            strike_price: parseFloat(document.getElementById('edit-strike').value),
            call_put: document.getElementById('edit-cp').value,
            initial_type: document.getElementById('edit-type').value,
            multiplier: parseFloat(document.getElementById('edit-multiplier').value) || 100,
            max_loss: parseFloat(maxLossStr) || 0
        };

        const response = await fetch(`api/positions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(posData)
        });

        if (response.ok) {
            modalEdit.style.display = 'none';
            loadPositions(currentStatus);
        }
    });

    window.openCloseModal = (id, initialType, currentQty) => {
        document.getElementById('close-pos-id').value = id;
        document.getElementById('close-qty').value = currentQty;
        document.getElementById('close-date').valueAsDate = new Date();
        document.getElementById('close-type').value = (initialType === 'BTO' || initialType === 'BTC') ? 'STC' : 'BTC';
        modalClose.style.display = 'block';
    };

    const closePriceInput = document.getElementById('close-option-price');
    const closeCommInput = document.getElementById('close-commission');
    const closeUsdInput = document.getElementById('close-total-usd');
    const closeTypeSelect = document.getElementById('close-type');
    const closeQtyInput = document.getElementById('close-qty');

    const calculateCloseTotal = () => {
        const id = document.getElementById('close-pos-id').value;
        const pos = allPositions.find(p => p.id === parseInt(id));
        const multiplier = pos ? pos.multiplier : 100;
        
        const qty = parseInt(closeQtyInput.value) || 0;
        const price = parseFloat(closePriceInput.value) || 0;
        const comm = parseFloat(closeCommInput.value) || 0;
        const type = closeTypeSelect.value;
        let total = qty * price * multiplier;
        if (type === 'BTO' || type === 'BTC') {
            closeUsdInput.value = (-(total + comm)).toFixed(2);
        } else {
            closeUsdInput.value = (total - comm).toFixed(2);
        }
    };

    [closePriceInput, closeCommInput, closeTypeSelect, closeQtyInput].forEach(el => {
        el.addEventListener('input', calculateCloseTotal);
    });

    formClose.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('close-pos-id').value;
        const data = {
            date: document.getElementById('close-date').value + "T00:00:00",
            transaction_type: document.getElementById('close-type').value,
            quantity: parseInt(document.getElementById('close-qty').value),
            option_price: parseFloat(document.getElementById('close-option-price').value),
            commission: parseFloat(document.getElementById('close-commission').value),
            total_usd: parseFloat(document.getElementById('close-total-usd').value)
        };

        const response = await fetch(`api/positions/${id}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            modalClose.style.display = 'none';
            formClose.reset();
            loadPositions(currentStatus);
        }
    });

    function calculateGroupEditMaxLoss() {
        const legs = Array.from(groupLegsContainer.querySelectorAll('.group-leg-row'));
        const qty = parseInt(document.getElementById('edit-group-qty').value) || 0;
        const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
        let totalNetUsd = 0;
        legs.forEach(leg => {
            totalNetUsd += parseFloat(leg.querySelector('.leg-usd').value) || 0;
        });

        let maxLoss = 0;
        let breakeven = 0;
        const netPremiumPerShare = Math.abs(totalNetUsd / multiplier / qty);

        if (legs.length === 2) {
            const types = legs.map(l => l.querySelector('.leg-type').value);
            const strikes = legs.map(l => parseFloat(l.querySelector('.leg-strike').value) || 0);
            const cps = legs.map(l => l.querySelector('.leg-cp').value);
            
            if (types.includes('STO') && types.includes('BTO')) {
                const strikeWidth = Math.abs(strikes[0] - strikes[1]);
                if (totalNetUsd > 0) { // Credit Spread
                    maxLoss = (strikeWidth * multiplier * qty) - totalNetUsd;
                    const shortStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'STO').querySelector('.leg-strike').value);
                    if (cps[0] === 'Put') {
                        breakeven = shortStrike - netPremiumPerShare;
                    } else {
                        breakeven = shortStrike + netPremiumPerShare;
                    }
                } else { // Debit Spread
                    maxLoss = Math.abs(totalNetUsd);
                    const longStrike = parseFloat(legs.find(l => l.querySelector('.leg-type').value === 'BTO').querySelector('.leg-strike').value);
                    if (cps[0] === 'Put') {
                        breakeven = longStrike - netPremiumPerShare;
                    } else {
                        breakeven = longStrike + netPremiumPerShare;
                    }
                }
            }
        } else if (legs.length === 1) {
            const type = legs[0].querySelector('.leg-type').value;
            const cp = legs[0].querySelector('.leg-cp').value;
            const strike = parseFloat(legs[0].querySelector('.leg-strike').value) || 0;
            
            if (type === 'STO' && cp === 'Put') {
                maxLoss = Math.abs(strike * multiplier * qty) - totalNetUsd;
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Put') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike - netPremiumPerShare;
            } else if (type === 'STO' && cp === 'Call') {
                maxLoss = 999999;
                breakeven = strike + netPremiumPerShare;
            } else if (type === 'BTO' && cp === 'Call') {
                maxLoss = Math.abs(totalNetUsd);
                breakeven = strike + netPremiumPerShare;
            }
        }
        
        document.getElementById('edit-group-max-loss').value = formatCurrency(maxLoss);
        document.getElementById('edit-group-breakeven').value = breakeven > 0 ? breakeven.toFixed(2) : '-';
    }

    window.openGroupEditModal = (groupId) => {
        const group = allPositions.filter(p => p.group_id === groupId);
        if (group.length === 0) return;

        document.getElementById('edit-group-id').value = groupId;
        document.getElementById('edit-group-symbol').value = group[0].symbol;
        document.getElementById('edit-group-date').value = group[0].date_opened.split('T')[0];
        document.getElementById('edit-group-exp-date').value = group[0].expiration_date ? group[0].expiration_date.split('T')[0] : '';
        document.getElementById('edit-group-multiplier').value = group[0].multiplier;
        
        const initialQty = group[0].transactions
            .filter(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO')
            .reduce((sum, t) => sum + t.quantity, 0);
        document.getElementById('edit-group-qty').value = initialQty;
        
        document.getElementById('edit-group-max-loss').value = group[0].max_loss ? formatCurrency(group[0].max_loss) : '0.00';

        // Show/hide Date Closed field
        const closedDateContainer = document.getElementById('edit-group-closed-date-container');
        const closedDateInput = document.getElementById('edit-group-closed-date');
        const isClosed = group.every(p => p.status === 'Closed');
        
        if (isClosed) {
            closedDateContainer.style.display = 'block';
            // Find the latest transaction date among all legs
            let latestDate = group[0].date_opened;
            group.forEach(p => {
                p.transactions.forEach(t => {
                    if (t.date > latestDate) latestDate = t.date;
                });
            });
            closedDateInput.value = latestDate.split('T')[0];
        } else {
            closedDateContainer.style.display = 'none';
        }

        groupLegsContainer.innerHTML = '';
        group.forEach(pos => {
            const div = document.createElement('div');
            div.className = 'leg-entry group-leg-row';
            div.dataset.posId = pos.id;
            
            const openTrans = pos.transactions.find(t => t.transaction_type === 'BTO' || t.transaction_type === 'STO');
            div.dataset.transId = openTrans ? openTrans.id : '';

            const isClosed = pos.status === 'Closed';
            const closeTrans = isClosed ? pos.transactions.find(t => t.transaction_type === 'BTC' || t.transaction_type === 'STC') : null;
            if (closeTrans) div.dataset.closeTransId = closeTrans.id;

            let closingHtml = '';
            if (closeTrans) {
                closingHtml = `
                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <span class="section-label">Closing Transaction</span>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Type</label>
                            <select class="close-leg-type">
                                <option value="BTC" ${closeTrans.transaction_type === 'BTC' ? 'selected' : ''}>BTC</option>
                                <option value="STC" ${closeTrans.transaction_type === 'STC' ? 'selected' : ''}>STC</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Close Price</label>
                            <input type="number" class="close-leg-price" step="0.01" value="${closeTrans.option_price}" required>
                        </div>
                        <div class="form-group">
                            <label>Comm (USD)</label>
                            <input type="number" class="close-leg-comm" step="0.01" value="${closeTrans.commission}">
                        </div>
                        <div class="form-group">
                            <label>Total USD</label>
                            <input type="number" class="close-leg-usd" step="0.01" value="${closeTrans.total_usd}" required>
                        </div>
                    </div>
                </div>`;
            }

            div.innerHTML = `
                <span class="section-label">Opening Transaction</span>
                <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                        <label>Contract Name</label>
                        <input type="text" class="leg-contract" value="${pos.contract_name}" required>
                    </div>
                    <div class="form-group">
                        <label>Strike</label>
                        <input type="number" class="leg-strike" step="0.5" value="${pos.strike_price}" required>
                    </div>
                    <div class="form-group">
                        <label>C/P</label>
                        <select class="leg-cp">
                            <option value="Call" ${pos.call_put === 'Call' ? 'selected' : ''}>Call</option>
                            <option value="Put" ${pos.call_put === 'Put' ? 'selected' : ''}>Put</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select class="leg-type">
                            <option value="BTO" ${openTrans.transaction_type === 'BTO' ? 'selected' : ''}>BTO</option>
                            <option value="STO" ${openTrans.transaction_type === 'STO' ? 'selected' : ''}>STO</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Option Price</label>
                        <input type="number" class="leg-price" step="0.01" value="${openTrans.option_price}" required>
                    </div>
                    <div class="form-group">
                        <label>Comm (USD)</label>
                        <input type="number" class="leg-comm" step="0.01" value="${openTrans.commission}">
                    </div>
                    <div class="form-group">
                        <label>Total USD</label>
                        <input type="number" class="leg-usd" step="0.01" value="${openTrans.total_usd}" required>
                    </div>
                </div>
                ${closingHtml}
            `;
            groupLegsContainer.appendChild(div);

            div.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', () => {
                    const strike = div.querySelector('.leg-strike').value;
                    const cp = div.querySelector('.leg-cp').value;
                    const expDate = document.getElementById('edit-group-exp-date').value;
                    const autoName = formatContractName(expDate, strike, cp);
                    if (autoName) div.querySelector('.leg-contract').value = autoName;

                    const qty = parseInt(document.getElementById('edit-group-qty').value) || 0;
                    const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
                    
                    // Update Opening Total
                    const price = parseFloat(div.querySelector('.leg-price').value) || 0;
                    const comm = parseFloat(div.querySelector('.leg-comm').value) || 0;
                    const type = div.querySelector('.leg-type').value;
                    let total = qty * price * multiplier;
                    if (type === 'BTO' || type === 'BTC') {
                        div.querySelector('.leg-usd').value = (-(total + comm)).toFixed(2);
                    } else {
                        div.querySelector('.leg-usd').value = (total - comm).toFixed(2);
                    }

                    // Update Closing Total if exists
                    const closePriceInput = div.querySelector('.close-leg-price');
                    if (closePriceInput) {
                        const cPrice = parseFloat(closePriceInput.value) || 0;
                        const cComm = parseFloat(div.querySelector('.close-leg-comm').value) || 0;
                        const cType = div.querySelector('.close-leg-type').value;
                        let cTotal = qty * cPrice * multiplier;
                        if (cType === 'BTO' || cType === 'BTC') {
                            div.querySelector('.close-leg-usd').value = (-(cTotal + cComm)).toFixed(2);
                        } else {
                            div.querySelector('.close-leg-usd').value = (cTotal - cComm).toFixed(2);
                        }
                    }
                    calculateGroupEditMaxLoss();
                });
            });
        });

        calculateGroupEditMaxLoss(); // Ensure breakeven and max loss are populated on load
        modalGroupEdit.style.display = 'block';
    };

    ['edit-group-qty', 'edit-group-exp-date', 'edit-group-multiplier'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            if (id === 'edit-group-exp-date') {
                groupLegsContainer.querySelectorAll('.group-leg-row').forEach(row => {
                    const strike = row.querySelector('.leg-strike').value;
                    const cp = row.querySelector('.leg-cp').value;
                    const autoName = formatContractName(document.getElementById(id).value, strike, cp);
                    if (autoName) row.querySelector('.leg-contract').value = autoName;
                });
            }
            groupLegsContainer.querySelectorAll('.group-leg-row').forEach(row => {
                row.querySelector('.leg-price').dispatchEvent(new Event('input'));
            });
            calculateGroupEditMaxLoss();
        });
    });

    const calculateGroupCloseTotal = () => {
        const legs = Array.from(groupCloseLegsContainer.querySelectorAll('.group-close-leg-row'));
        const qtyToClose = parseInt(document.getElementById('close-group-qty').value) || 0;
        let grandClosingTotal = 0;
        let grandOpeningCost = 0;

        const groupId = document.getElementById('close-group-id').value;
        const group = allPositions.filter(p => p.group_id === groupId);
        const multiplier = group.length > 0 ? group[0].multiplier : 100;
        
        legs.forEach(leg => {
            const price = parseFloat(leg.querySelector('.close-leg-price').value) || 0;
            const comm = parseFloat(leg.querySelector('.close-leg-comm').value) || 0;
            const type = leg.querySelector('.close-leg-type').value;
            
            let total = qtyToClose * price * multiplier;
            let legClosingTotal = 0;
            if (type === 'BTO' || type === 'BTC') {
                legClosingTotal = -(total + comm);
            } else {
                legClosingTotal = total - comm;
            }
            
            leg.querySelector('.close-leg-total').value = formatCurrency(legClosingTotal);
            grandClosingTotal += legClosingTotal;

            const posId = parseInt(leg.dataset.posId);
            const pos = allPositions.find(p => p.id === posId);
            if (pos) {
                const proRatedOpeningCost = (pos.total_cost_usd / pos.current_quantity) * qtyToClose;
                grandOpeningCost += proRatedOpeningCost;
            }
        });
        
        const totalEl = document.getElementById('group-close-net-total');
        totalEl.textContent = formatCurrency(grandClosingTotal);
        totalEl.className = grandClosingTotal >= 0 ? 'pnl-positive' : 'pnl-negative';

        const pnl = grandOpeningCost + grandClosingTotal;
        const pnlEl = document.getElementById('group-close-pnl');
        pnlEl.textContent = formatCurrency(pnl);
        pnlEl.className = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    };

    window.openGroupCloseModal = (groupId) => {
        const group = allPositions.filter(p => p.group_id === groupId);
        if (group.length === 0) return;

        document.getElementById('close-group-id').value = groupId;
        document.getElementById('close-group-date').valueAsDate = new Date();
        document.getElementById('close-group-qty').value = group[0].current_quantity;

        groupCloseLegsContainer.innerHTML = '';
        group.forEach(pos => {
            const div = document.createElement('div');
            div.className = 'leg-entry group-close-leg-row';
            div.dataset.posId = pos.id;
            
            const closeType = (pos.initial_type === 'BTO' || pos.initial_type === 'BTC') ? 'STC' : 'BTC';

            div.innerHTML = `
                <div class="form-row" style="align-items: center; margin-bottom: 5px;">
                    <div style="flex: 2; font-weight: bold;">${pos.contract_name}</div>
                    <div style="flex: 1; color: #94a3b8; font-size: 0.9rem;">${pos.initial_type} -> ${closeType}</div>
                    <input type="hidden" class="close-leg-type" value="${closeType}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Close Price</label>
                        <input type="number" class="close-leg-price" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Comm (USD)</label>
                        <input type="number" class="close-leg-comm" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label>Total USD</label>
                        <input type="text" class="close-leg-total" readonly style="background: #334155; opacity: 0.7;">
                    </div>
                </div>
            `;
            groupCloseLegsContainer.appendChild(div);

            div.querySelectorAll('input').forEach(el => {
                el.addEventListener('input', calculateGroupCloseTotal);
            });
        });

        calculateGroupCloseTotal();
        modalGroupClose.style.display = 'block';
    };
    document.getElementById('close-group-qty').addEventListener('input', calculateGroupCloseTotal);

    formGroupClose.addEventListener('submit', async (e) => {
        e.preventDefault();
        const closeDate = document.getElementById('close-group-date').value + "T00:00:00";
        const quantity = parseInt(document.getElementById('close-group-qty').value);
        
        const legRows = document.querySelectorAll('.group-close-leg-row');
        const requests = Array.from(legRows).map(row => {
            const posId = row.dataset.posId;
            const data = {
                date: closeDate,
                transaction_type: row.querySelector('.close-leg-type').value,
                quantity: quantity,
                option_price: parseFloat(row.querySelector('.close-leg-price').value),
                commission: parseFloat(row.querySelector('.close-leg-comm').value),
                total_usd: parseFloat(row.querySelector('.close-leg-total').value.replace(/,/g, ''))
            };
            return fetch(`api/positions/${posId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        });

        try {
            const results = await Promise.all(requests);
            if (results.every(r => r.ok)) {
                modalGroupClose.style.display = 'none';
                loadPositions('Open');
            } else {
                alert("Failed to close some legs. Please check manually.");
            }
        } catch (error) {
            console.error("Batch close failed:", error);
            alert("An error occurred during batch close.");
        }
    });

    formGroupEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dateOpened = document.getElementById('edit-group-date').value + "T00:00:00";
        const expirationDate = document.getElementById('edit-group-exp-date').value + "T00:00:00";
        const quantity = parseInt(document.getElementById('edit-group-qty').value);
        const multiplier = parseFloat(document.getElementById('edit-group-multiplier').value) || 100;
        const maxLossStr = document.getElementById('edit-group-max-loss').value.replace(/,/g, '');
        const maxLoss = parseFloat(maxLossStr) || 0;
        
        const closedDateInput = document.getElementById('edit-group-closed-date');
        const closedDate = (closedDateInput && closedDateInput.value) ? closedDateInput.value + "T00:00:00" : null;

        const legRows = document.querySelectorAll('#edit-group-legs-container .group-leg-row');
        for (const row of legRows) {
            const posId = row.dataset.posId;
            const transId = row.dataset.transId; // This is the opening transaction id

            // 1. Update the opening transaction
            const transData = {
                date: dateOpened,
                transaction_type: row.querySelector('.leg-type').value,
                quantity: quantity,
                option_price: parseFloat(row.querySelector('.leg-price').value),
                commission: parseFloat(row.querySelector('.leg-comm').value),
                total_usd: parseFloat(row.querySelector('.leg-usd').value)
            };
            await fetch(`api/transactions/${transId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transData)
            });

            // 2. Update closing transaction if it exists
            const closeTransId = row.dataset.closeTransId;
            if (closeTransId) {
                const closeTransData = {
                    date: closedDate || dateOpened, // Default to open date if no close date set
                    transaction_type: row.querySelector('.close-leg-type').value,
                    quantity: quantity,
                    option_price: parseFloat(row.querySelector('.close-leg-price').value),
                    commission: parseFloat(row.querySelector('.close-leg-comm').value),
                    total_usd: parseFloat(row.querySelector('.close-leg-usd').value)
                };
                await fetch(`api/transactions/${closeTransId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(closeTransData)
                });
            }

            // 3. Update position metadata
            const posData = {
                date_opened: dateOpened,
                expiration_date: expirationDate,
                contract_name: row.querySelector('.leg-contract').value,
                strike_price: parseFloat(row.querySelector('.leg-strike').value),
                call_put: row.querySelector('.leg-cp').value,
                initial_type: row.querySelector('.leg-type').value,
                multiplier: multiplier,
                max_loss: maxLoss
            };
            await fetch(`api/positions/${posId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(posData)
            });
        }

        modalGroupEdit.style.display = 'none';
        loadPositions(currentStatus);
    });

    window.deletePosition = async (id) => {
        if (!confirm('Are you sure you want to delete this position and its history?')) return;
        const response = await fetch(`api/positions/${id}`, { method: 'DELETE' });
        if (response.ok) loadPositions(currentStatus);
    };

    window.deleteGroup = async (groupId) => {
        if (!confirm('Are you sure you want to delete this ENTIRE group and all legs?')) return;
        const response = await fetch(`api/positions/group/${groupId}`, { method: 'DELETE' });
        if (response.ok) loadPositions(currentStatus);
    };

    window.toggleDetails = (btn, posId) => {
        const row = document.querySelector(`.pos-details-${posId}`);
        if (row) {
            const isHidden = row.style.display === 'none';
            row.style.display = isHidden ? '' : 'none';
            // btn.style.backgroundColor = isHidden ? '#475569' : '#334155';
        }
    };

    async function fetchCurrentPrices() {
        const symbols = new Set();
        document.querySelectorAll('.price-val').forEach(el => {
            symbols.add(el.dataset.symbol);
        });

        if (symbols.size === 0) return;

        try {
            const response = await fetch(`api/prices?symbols=${Array.from(symbols).join(',')}`);
            if (!response.ok) return;
            const prices = await response.json();

            // Update all price-val elements in the document
            document.querySelectorAll('.price-val').forEach(priceEl => {
                const symbol = priceEl.dataset.symbol;
                const currentPrice = prices[symbol];
                if (currentPrice !== undefined) {
                    priceEl.textContent = formatCurrency(currentPrice);
                } else {
                    priceEl.textContent = 'Unavailable';
                }
            });

            // Update all risk-status elements in the document
            document.querySelectorAll('.risk-status').forEach(riskEl => {
                const symbol = riskEl.dataset.symbol;
                const currentPrice = prices[symbol];
                const strike = parseFloat(riskEl.dataset.strike);
                const cp = riskEl.dataset.cp;

                if (currentPrice !== undefined) {
                    let distance = 0;
                    let isITM = false;

                    if (cp === 'Call') {
                        isITM = currentPrice > strike;
                        distance = ((currentPrice - strike) / strike) * 100;
                    } else {
                        isITM = currentPrice < strike;
                        distance = ((strike - currentPrice) / strike) * 100;
                    }

                    const statusText = isITM ? 'ITM 🔴' : 'OTM 🟢';
                    riskEl.innerHTML = `${statusText} <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8;">(${Math.abs(distance).toFixed(2)}% from strike)</span>`;
                } else {
                    riskEl.textContent = '-';
                }
            });
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    }

    loadPositions('Open');
});
